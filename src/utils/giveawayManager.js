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
        const customId = interaction.customId;
        
        if (customId.startsWith('giveaway_enter_')) {
            const giveawayId = customId.replace('giveaway_enter_', '');
            await this.handleGiveawayEntry(interaction, giveawayId, client);
        }
    }
    
    static async handleGiveawayEntry(interaction, giveawayId, client) {
        // Defer reply immediately to prevent interaction timeout
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const giveaway = await Giveaway.findOne({ 
                giveawayId, 
                status: 'active' 
            });
            
            if (!giveaway) {
                const embed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Giveaway Not Found')
                    .setDescription('This giveaway is no longer active or has ended.');
                
                return interaction.editReply({ embeds: [embed] });
            }
            
            // Check if already entered
            const alreadyEntered = giveaway.entries.some(e => e.userId === interaction.user.id);
            if (alreadyEntered) {
                const embed = new PremiumEmbed()
                    .setWarning()
                    .setTitle('⚠️ Already Entered')
                    .setDescription(`You have already entered this giveaway!\n\n**Current Entries:** ${giveaway.entries.length}`);
                
                return interaction.editReply({ embeds: [embed] });
            }
            
            // Check requirements
            const userData = await User.findOne({ 
                userId: interaction.user.id, 
                guildId: interaction.guild.id 
            });
            
            // XP Requirement Check
            if (giveaway.requirements.xp > 0) {
                const userXp = userData?.totalXp || 0;
                if (userXp < giveaway.requirements.xp) {
                    const embed = new PremiumEmbed()
                        .setError()
                        .setTitle('❌ Requirement Not Met')
                        .setDescription(`You need **${giveaway.requirements.xp}** XP to enter this giveaway.`)
                        .addField('Your XP', userXp.toString(), true)
                        .addField('Required XP', giveaway.requirements.xp.toString(), true);
                    
                    return interaction.editReply({ embeds: [embed] });
                }
            }
            
            // Invite Requirement Check
            if (giveaway.requirements.invites > 0) {
                const userInvites = userData?.invites?.total || 0;
                if (userInvites < giveaway.requirements.invites) {
                    const embed = new PremiumEmbed()
                        .setError()
                        .setTitle('❌ Requirement Not Met')
                        .setDescription(`You need **${giveaway.requirements.invites}** invites to enter this giveaway.`)
                        .addField('Your Invites', userInvites.toString(), true)
                        .addField('Required Invites', giveaway.requirements.invites.toString(), true);
                    
                    return interaction.editReply({ embeds: [embed] });
                }
            }
            
            // Role Requirement Check
            if (giveaway.requirements.role) {
                if (!interaction.member.roles.cache.has(giveaway.requirements.role)) {
                    const role = interaction.guild.roles.cache.get(giveaway.requirements.role);
                    const embed = new PremiumEmbed()
                        .setError()
                        .setTitle('❌ Requirement Not Met')
                        .setDescription(`You need the **${role?.name || 'required'}** role to enter this giveaway.`);
                    
                    return interaction.editReply({ embeds: [embed] });
                }
            }
            
            // Add entry
            giveaway.entries.push({
                userId: interaction.user.id,
                username: interaction.user.username,
                joinedAt: new Date()
            });
            
            await giveaway.save();
            
            // Update giveaway message with live entries
            await this.updateGiveawayMessage(giveaway, client);
            
            // Calculate win chance
            const winChance = ((giveaway.winners / giveaway.entries.length) * 100).toFixed(2);
            
            const embed = new PremiumEmbed()
                .setSuccess()
                .setTitle('✅ Successfully Entered!')
                .setDescription(`You have entered the giveaway for **${giveaway.prize}**!`)
                .addField('📊 Total Entries', giveaway.entries.length.toString(), true)
                .addField('🎯 Win Chance', `${winChance}%`, true)
                .addField('⏰ Ends', `<t:${Math.floor(new Date(giveaway.endTime).getTime() / 1000)}:R>`, true)
                .setFooter({ text: `Giveaway ID: ${giveawayId} • Good luck! 🍀` });
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            logger.error('Giveaway entry error:', error);
            
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Error')
                .setDescription('An error occurred while entering the giveaway. Please try again.');
            
            await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
        }
    }
    
    static async updateGiveawayMessage(giveaway, client) {
        try {
            const channel = await client.channels.fetch(giveaway.channelId);
            if (!channel) return;
            
            const message = await channel.messages.fetch(giveaway.messageId);
            if (!message) return;
            
            const oldEmbed = message.embeds[0];
            if (!oldEmbed) return;
            
            // Requirements text
            let requirementsText = '';
            if (giveaway.requirements.xp > 0) requirementsText += `• XP Required: ${giveaway.requirements.xp}\n`;
            if (giveaway.requirements.invites > 0) requirementsText += `• Invites Required: ${giveaway.requirements.invites}\n`;
            if (giveaway.requirements.role) {
                const role = channel.guild.roles.cache.get(giveaway.requirements.role);
                requirementsText += `• Role Required: ${role?.name || 'Unknown'}\n`;
            }
            if (!requirementsText) requirementsText = '• None';
            
            const embed = new PremiumEmbed()
                .setTitle(oldEmbed.title || `🎉 ${giveaway.prize}`)
                .setDescription(
                    `**Hosted by:** <@${giveaway.hostId}>\n\n` +
                    `**Ends:** <t:${Math.floor(new Date(giveaway.endTime).getTime() / 1000)}:R>\n` +
                    `**Entries:** ${giveaway.entries.length}\n` +
                    `**Winners:** ${giveaway.winners}`
                )
                .addField('📋 Requirements', requirementsText)
                .setFooter({ text: `Giveaway ID: ${giveaway.giveawayId} • Click the button below to enter!` });
            
            const enterButton = new ButtonBuilder()
                .setCustomId(`giveaway_enter_${giveaway.giveawayId}`)
                .setLabel('🎉 Enter Giveaway')
                .setStyle(ButtonStyle.Success);
            
            const row = new ActionRowBuilder().addComponents(enterButton);
            
            await message.edit({ embeds: [embed], components: [row] });
            
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
            if (channel) {
                const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
                
                if (message) {
                    const embed = new PremiumEmbed(message.embeds[0]?.data || {})
                        .setTitle(`🎉 ENDED: ${giveaway.prize}`)
                        .setDescription(
                            `**Hosted by:** <@${giveaway.hostId}>\n\n` +
                            `**Total Entries:** ${giveaway.entries.length}\n` +
                            `**Winners:** ${giveaway.winners}\n\n` +
                            `This giveaway has ended!`
                        )
                        .setColor(0xFF0000)
                        .setFooter({ text: `Giveaway ID: ${giveawayId} • Ended` });
                    
                    const disabledButton = new ButtonBuilder()
                        .setCustomId('giveaway_ended')
                        .setLabel('Giveaway Ended')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true);
                    
                    const row = new ActionRowBuilder().addComponents(disabledButton);
                    
                    await message.edit({ embeds: [embed], components: [row] });
                }
                
                // Announce winners
                if (winners.length > 0) {
                    const winnerEmbed = new PremiumEmbed()
                        .setTitle('🎉 Giveaway Winners!')
                        .setDescription(`Congratulations to the winner(s) of **${giveaway.prize}**!`)
                        .addField('👑 Winners', winners.map(w => `<@${w.userId}>`).join('\n'))
                        .addField('📊 Total Entries', giveaway.entries.length.toString())
                        .setFooter({ text: `Giveaway ID: ${giveawayId}` });
                    
                    await channel.send({ 
                        content: winners.map(w => `<@${w.userId}>`).join(' '),
                        embeds: [winnerEmbed] 
                    });
                } else {
                    const noWinnersEmbed = new PremiumEmbed()
                        .setWarning()
                        .setTitle('😢 No Winners')
                        .setDescription(`No valid entries for **${giveaway.prize}**!`);
                    
                    await channel.send({ embeds: [noWinnersEmbed] });
                }
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
        const uniqueWinners = [];
        const seenIds = new Set();
        
        for (const entry of shuffled) {
            if (!seenIds.has(entry.userId)) {
                seenIds.add(entry.userId);
                uniqueWinners.push(entry);
            }
            if (uniqueWinners.length >= count) break;
        }
        
        return uniqueWinners;
    }
}

module.exports = { GiveawayManager };
