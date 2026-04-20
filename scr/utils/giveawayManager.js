const Giveaway = require('../models/Giveaway');
const User = require('../models/User');
const { PremiumEmbed } = require('./embedBuilder');
const { logger } = require('./logger');
const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

class GiveawayManager {
    static async createGiveaway(data) {
        const giveaway = new Giveaway(data);
        await giveaway.save();
        return giveaway;
    }
    
    static async loadGiveaways(client) {
        const giveaways = await Giveaway.find({ status: 'active' });
        
        for (const gw of giveaways) {
            const now = Date.now();
            const endTime = new Date(gw.endTime).getTime();
            
            if (endTime <= now) {
                await this.endGiveaway(gw.giveawayId, client);
            } else {
                client.giveaways.set(gw.giveawayId, {
                    messageId: gw.messageId,
                    channelId: gw.channelId,
                    endTime: endTime,
                    winners: gw.winners
                });
                
                setTimeout(() => {
                    this.endGiveaway(gw.giveawayId, client);
                }, endTime - now);
            }
        }
        
        logger.info(`Loaded ${client.giveaways.size} active giveaways`);
    }
    
    static async handleGiveawayButton(interaction, client) {
        const [action, giveawayId] = interaction.customId.split('_').slice(1);
        
        if (action === 'enter') {
            await this.handleGiveawayEntry(interaction, giveawayId);
        }
    }
    
    static async handleGiveawayEntry(interaction, giveawayId) {
        const giveaway = await Giveaway.findOne({ 
            giveawayId, 
            status: 'active' 
        });
        
        if (!giveaway) {
            const embed = new PremiumEmbed()
                .setError()
                .setTitle('Giveaway Not Found')
                .setDescription('This giveaway is no longer active.');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Check if already entered
        if (giveaway.entries.some(e => e.userId === interaction.user.id)) {
            const embed = new PremiumEmbed()
                .setWarning()
                .setTitle('Already Entered')
                .setDescription('You have already entered this giveaway!');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Check requirements
        const userData = await User.findOne({ 
            userId: interaction.user.id, 
            guildId: interaction.guild.id 
        });
        
        if (giveaway.requirements.xp > 0) {
            const userXp = userData?.totalXp || 0;
            if (userXp < giveaway.requirements.xp) {
                const embed = new PremiumEmbed()
                    .setError()
                    .setTitle('Requirement Not Met')
                    .setDescription(`You need ${giveaway.requirements.xp} XP to enter this giveaway.\nYou have: ${userXp} XP`);
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
        
        if (giveaway.requirements.invites > 0) {
            const userInvites = userData?.invites?.total || 0;
            if (userInvites < giveaway.requirements.invites) {
                const embed = new PremiumEmbed()
                    .setError()
                    .setTitle('Requirement Not Met')
                    .setDescription(`You need ${giveaway.requirements.invites} invites to enter this giveaway.\nYou have: ${userInvites} invites`);
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
        
        if (giveaway.requirements.role) {
            if (!interaction.member.roles.cache.has(giveaway.requirements.role)) {
                const role = interaction.guild.roles.cache.get(giveaway.requirements.role);
                const embed = new PremiumEmbed()
                    .setError()
                    .setTitle('Requirement Not Met')
                    .setDescription(`You need the ${role?.name || 'required'} role to enter this giveaway.`);
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
        
        // Add entry
        giveaway.entries.push({
            userId: interaction.user.id,
            username: interaction.user.username,
            joinedAt: new Date()
        });
        
        await giveaway.save();
        
        // Update giveaway message
        await this.updateGiveawayMessage(giveaway, client);
        
        const embed = new PremiumEmbed()
            .setSuccess()
            .setTitle('Successfully Entered!')
            .setDescription(`You have entered the giveaway for **${giveaway.prize}**!`)
            .addField('Total Entries', giveaway.entries.length.toString())
            .setFooter({ text: `Giveaway ID: ${giveawayId}` });
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    static async updateGiveawayMessage(giveaway, client) {
        try {
            const channel = await client.channels.fetch(giveaway.channelId);
            const message = await channel.messages.fetch(giveaway.messageId);
            
            const embed = new PremiumEmbed(message.embeds[0].data);
            
            // Update description with current entries
            const description = embed.data.description;
            const newDescription = description.replace(/Entries: \d+/, `Entries: ${giveaway.entries.length}`);
            embed.setDescription(newDescription);
            
            await message.edit({ embeds: [embed] });
        } catch (error) {
            logger.error('Failed to update giveaway message:', error);
        }
    }
    
    static async endGiveaway(giveawayId, client, force = false) {
        const giveaway = await Giveaway.findOne({ 
            giveawayId,
            $or: [
                { status: 'active' },
                ...(force ? [{ status: 'ended' }] : [])
            ]
        });
        
        if (!giveaway) {
            return { success: false, message: 'Giveaway not found or already ended.' };
        }
        
        if (giveaway.status === 'ended' && !force) {
            return { success: false, message: 'This giveaway has already ended.' };
        }
        
        // Pick winners
        const winners = this.pickWinners(giveaway.entries, giveaway.winners);
        
        giveaway.winnersList = winners.map(w => ({
            userId: w.userId,
            username: w.username,
            announcedAt: new Date()
        }));
        
        giveaway.status = 'ended';
        await giveaway.save();
        
        // Remove from memory
        client.giveaways.delete(giveawayId);
        
        // Update giveaway message
        try {
            const channel = await client.channels.fetch(giveaway.channelId);
            const message = await channel.messages.fetch(giveaway.messageId);
            
            const embed = new PremiumEmbed(message.embeds[0].data)
                .setTitle(`🎉 ENDED: ${giveaway.prize}`)
                .setDescription('This giveaway has ended!')
                .setColor(0xFF0000);
            
            const disabledButton = new ButtonBuilder()
                .setCustomId('giveaway_ended')
                .setLabel('Giveaway Ended')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);
            
            const row = new ActionRowBuilder().addComponents(disabledButton);
            
            await message.edit({ embeds: [embed], components: [row] });
            
            // Announce winners
            if (winners.length > 0) {
                const winnerEmbed = new PremiumEmbed()
                    .setTitle('🎉 Giveaway Winners!')
                    .setDescription(`Congratulations to the winner(s) of **${giveaway.prize}**!`)
                    .addField('Winners', winners.map(w => `<@${w.userId}>`).join('\n'))
                    .setFooter({ text: `Giveaway ID: ${giveawayId}` });
                
                await channel.send({ 
                    content: winners.map(w => `<@${w.userId}>`).join(' '),
                    embeds: [winnerEmbed] 
                });
            } else {
                const noWinnersEmbed = new PremiumEmbed()
                    .setWarning()
                    .setTitle('No Winners')
                    .setDescription(`No valid entries for **${giveaway.prize}**!`);
                
                await channel.send({ embeds: [noWinnersEmbed] });
            }
        } catch (error) {
            logger.error('Failed to update ended giveaway:', error);
        }
        
        return { 
            success: true, 
            winners: winners,
            giveaway: giveaway 
        };
    }
    
    static async rerollGiveaway(giveawayId, guildId) {
        const giveaway = await Giveaway.findOne({ giveawayId, guildId });
        
        if (!giveaway) {
            return { success: false, message: 'Giveaway not found.' };
        }
        
        if (giveaway.status !== 'ended') {
            return { success: false, message: 'Only ended giveaways can be rerolled.' };
        }
        
        if (giveaway.entries.length === 0) {
            return { success: false, message: 'No entries to pick winners from.' };
        }
        
        // Pick new winners
        const newWinners = this.pickWinners(giveaway.entries, giveaway.winners);
        
        giveaway.winnersList = newWinners.map(w => ({
            userId: w.userId,
            username: w.username,
            announcedAt: new Date()
        }));
        
        giveaway.rerollCount += 1;
        await giveaway.save();
        
        return {
            success: true,
            winners: newWinners,
            giveaway: giveaway
        };
    }
    
    static pickWinners(entries, count) {
        if (entries.length === 0) return [];
        
        const shuffled = [...entries].sort(() => Math.random() - 0.5);
        const uniqueWinners = [...new Set(shuffled)];
        
        return uniqueWinners.slice(0, Math.min(count, uniqueWinners.length));
    }
}

module.exports = { GiveawayManager };
