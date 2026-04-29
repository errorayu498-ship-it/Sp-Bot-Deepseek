const { SlashCommandBuilder, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const Giveaway = require('../../models/Giveaway');
const Guild = require('../../models/Guild');
const ms = require('ms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fgw')
        .setDescription('Create a fixed giveaway with pre-set winners')
        .addStringOption(option =>
            option.setName('prize')
                .setDescription('The prize for the giveaway')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('Number of winners')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(20))
        .addStringOption(option =>
            option.setName('winners_id')
                .setDescription('Pre-set winner IDs (comma separated, e.g., ID1,ID2,ID3)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (e.g., 1h, 30m, 1d) - Optional, default 24h')
                .setRequired(false))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel for the giveaway')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('xp_requirement')
                .setDescription('Required XP to enter')
                .setRequired(false)
                .setMinValue(0))
        .addIntegerOption(option =>
            option.setName('invite_requirement')
                .setDescription('Required invites to enter')
                .setRequired(false)
                .setMinValue(0))
        .addRoleOption(option =>
            option.setName('role_requirement')
                .setDescription('Required role to enter')
                .setRequired(false)),
    
    adminOnly: true,
    
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        
        const prize = interaction.options.getString('prize');
        const winners = interaction.options.getInteger('winners');
        const winnersIdStr = interaction.options.getString('winners_id');
        let duration = interaction.options.getString('duration') || '24h';
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const xpReq = interaction.options.getInteger('xp_requirement') || 0;
        const inviteReq = interaction.options.getInteger('invite_requirement') || 0;
        const roleReq = interaction.options.getRole('role_requirement');
        
        // Parse winner IDs
        const winnerIds = winnersIdStr.split(',').map(id => id.trim()).filter(id => id.length > 0);
        
        // Validate winner IDs
        if (winnerIds.length < winners) {
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Not Enough Winner IDs')
                .setDescription(`You set **${winners}** winners but only provided **${winnerIds.length}** winner IDs.`)
                .addField('Required', `${winners} winner IDs`, true)
                .addField('Provided', `${winnerIds.length} winner IDs`, true)
                .addField('💡 Tip', 'Make sure winner IDs count matches the winners count!\nUse comma to separate: `ID1,ID2,ID3`');
            
            return interaction.editReply({ embeds: [errorEmbed] });
        }
        
        // Validate that IDs exist and are in server
        const validWinners = [];
        const invalidIds = [];
        
        for (const id of winnerIds.slice(0, winners)) {
            try {
                const user = await client.users.fetch(id);
                const member = await interaction.guild.members.fetch(id).catch(() => null);
                
                if (user && member) {
                    validWinners.push({
                        userId: id,
                        username: user.username,
                        tag: user.tag
                    });
                } else {
                    invalidIds.push(id);
                }
            } catch (error) {
                invalidIds.push(id);
            }
        }
        
        if (invalidIds.length > 0) {
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Invalid User IDs')
                .setDescription('Some winner IDs are invalid or users are not in this server!')
                .addField('❌ Invalid IDs', invalidIds.map(id => `\`${id}\``).join('\n'))
                .addField('💡 Tip', 'Make sure all IDs are valid and users are in this server.');
            
            return interaction.editReply({ embeds: [errorEmbed] });
        }
        
        if (validWinners.length < winners) {
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Not Enough Valid Winners')
                .setDescription(`Only **${validWinners.length}** valid winners found out of **${winners}** required.`);
            
            return interaction.editReply({ embeds: [errorEmbed] });
        }
        
        // Parse duration
        const durationMs = ms(duration);
        if (!durationMs || durationMs < 60000) {
            const errorEmbed = new PremiumEmbed()
                .setWarning()
                .setTitle('⚠️ Invalid Duration')
                .setDescription('Duration must be at least 1 minute! Using default 24h.');
            
            duration = '24h';
        }
        
        const finalDurationMs = ms(duration) || 86400000;
        const endTime = new Date(Date.now() + finalDurationMs);
        
        // Generate unique giveaway ID
        const giveawayId = Math.floor(10000 + Math.random() * 90000).toString();
        
        // Requirements display
        let requirementsText = '';
        if (xpReq > 0) requirementsText += `• XP Required: **${xpReq}**\n`;
        if (inviteReq > 0) requirementsText += `• Invites Required: **${inviteReq}**\n`;
        if (roleReq) requirementsText += `• Role Required: **${roleReq}**\n`;
        if (!requirementsText) requirementsText = '• None (Open to all)';
        
        // Create giveaway embed (looks like normal giveaway)
        const embed = new PremiumEmbed()
            .setTitle(`🎉 ${prize}`)
            .setDescription(
                `**Hosted by:** ${interaction.user}\n\n` +
                `**Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>\n` +
                `**Entries:** 0\n` +
                `**Winners:** ${winners}`
            )
            .addField('📋 Requirements', requirementsText)
            .addField('🏷️ Type', 'SP Giveaway', true)
            .setFooter({ text: `Giveaway ID: ${giveawayId} • Click the button below to enter!` })
            .setTimestamp();
        
        // Create enter button
        const enterButton = new ButtonBuilder()
            .setCustomId(`fgw_enter_${giveawayId}`)
            .setLabel('🎉 Enter Giveaway')
            .setStyle(ButtonStyle.Success);
        
        const row = new ActionRowBuilder().addComponents(enterButton);
        
        // Send giveaway message
        const giveawayMessage = await channel.send({ 
            embeds: [embed], 
            components: [row] 
        });
        
        // Save to database
        const giveawayData = new Giveaway({
            giveawayId: `fgw_${giveawayId}`,
            guildId: interaction.guild.id,
            channelId: channel.id,
            messageId: giveawayMessage.id,
            prize: prize,
            winners: winners,
            hostId: interaction.user.id,
            requirements: {
                xp: xpReq,
                invites: inviteReq,
                role: roleReq?.id || null
            },
            entries: [],
            winnersList: [],
            startTime: new Date(),
            endTime: endTime,
            status: 'active',
            rerollCount: 0,
            isFixedGiveaway: true,
            fixedWinners: validWinners.slice(0, winners)
        });
        
        await giveawayData.save();
        
        // Store in memory
        client.giveaways.set(`fgw_${giveawayId}`, {
            messageId: giveawayMessage.id,
            channelId: channel.id,
            endTime: endTime.getTime(),
            winners,
            prize,
            isFixed: true,
            fixedWinners: validWinners.slice(0, winners)
        });
        
        // Schedule giveaway end
        setTimeout(() => {
            endFixedGiveaway(`fgw_${giveawayId}`, client);
        }, finalDurationMs);
        
        // Success embed for admin
        const successEmbed = new PremiumEmbed()
            .setSuccess()
            .setTitle('✅ Giveaway Created!')
            .setDescription(`Giveaway created successfully in ${channel}`)
            .addField('🎁 Prize', prize, true)
            .addField('🆔 Giveaway ID', `fgw_${giveawayId}`, true)
            .addField('👑 Winners', winners.toString(), true)
            .addField('⏰ Ends', `<t:${Math.floor(endTime.getTime() / 1000)}:F>`, true)
            .addField('📋 Requirements', requirementsText)
            .addField('Premium Member', validWinners.slice(0, winners).map((w, i) => 
                `${i + 1}. <@${w.userId}> (${w.tag})`
            ).join('\n'))
            .addField('Note', 'This is a **Premium** giveaway.')
            .setFooter({ text: 'Fixed Giveaway System' });
        
        await interaction.editReply({ embeds: [successEmbed] });
        
        // Update guild stats
        await Guild.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { $inc: { 'stats.totalGiveaways': 1 } },
            { upsert: true }
        );
    }
};

// Function to end fixed giveaway
async function endFixedGiveaway(giveawayId, client) {
    try {
        const giveaway = await Giveaway.findOne({ 
            giveawayId: giveawayId,
            status: 'active'
        });
        
        if (!giveaway) return;
        
        // Get pre-set winners
        const presetWinners = giveaway.fixedWinners || [];
        
        if (presetWinners.length === 0) {
            // No preset winners, cancel
            giveaway.status = 'cancelled';
            await giveaway.save();
            return;
        }
        
        // Set winners
        giveaway.winnersList = presetWinners.map(w => ({
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
                        .setFooter({ text: `Giveaway ID: ${giveawayId.replace('fgw_', '')} • Ended` });
                    
                    const disabledButton = new ButtonBuilder()
                        .setCustomId('fgw_ended')
                        .setLabel('Giveaway Ended')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true);
                    
                    const row = new ActionRowBuilder().addComponents(disabledButton);
                    
                    await message.edit({ embeds: [embed], components: [row] });
                }
                
                // Announce winners
                if (presetWinners.length > 0) {
                    const winnerEmbed = new PremiumEmbed()
                        .setTitle('🎉 Giveaway Winners!')
                        .setDescription(`Congratulations to the winner(s) of **${giveaway.prize}**!`)
                        .addField('👑 Winners', presetWinners.map(w => `<@${w.userId}> (${w.tag})`).join('\n'))
                        .addField('📊 Total Entries', giveaway.entries.length.toString())
                        .addField('🏷️ Type', 'SP Giveaway', true)
                        .setFooter({ text: `Giveaway ID: ${giveawayId.replace('fgw_', '')}` });
                    
                    await channel.send({ 
                        content: presetWinners.map(w => `<@${w.userId}>`).join(' '),
                        embeds: [winnerEmbed] 
                    });
                }
            }
        } catch (error) {
            console.error('Failed to update ended fixed giveaway:', error);
        }
        
    } catch (error) {
        console.error('End Fixed Giveaway Error:', error);
    }
}

// Export the end function for use in giveaway manager
module.exports.endFixedGiveaway = endFixedGiveaway;
