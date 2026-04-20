const { SlashCommandBuilder, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const { GiveawayManager } = require('../../utils/giveawayManager');
const ms = require('ms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cgw')
        .setDescription('Create a new giveaway')
        .addStringOption(option =>
            option.setName('prize')
                .setDescription('The prize for the giveaway')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('Number of winners')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10))
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
        let duration = interaction.options.getString('duration') || '24h'; // Default 24 hours
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const xpReq = interaction.options.getInteger('xp_requirement') || 0;
        const inviteReq = interaction.options.getInteger('invite_requirement') || 0;
        const roleReq = interaction.options.getRole('role_requirement');
        
        // Parse duration
        const durationMs = ms(duration);
        if (!durationMs || durationMs < 60000) {
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('Invalid Duration')
                .setDescription('Duration must be at least 1 minute! Using default 24h.');
            
            duration = '24h';
        }
        
        const finalDurationMs = ms(duration) || 86400000; // 24h default
        const endTime = new Date(Date.now() + finalDurationMs);
        
        // Generate unique giveaway ID
        const giveawayId = Math.floor(1000 + Math.random() * 9000).toString();
        
        // Requirements display
        let requirementsText = '';
        if (xpReq > 0) requirementsText += `• XP Required: ${xpReq}\n`;
        if (inviteReq > 0) requirementsText += `• Invites Required: ${inviteReq}\n`;
        if (roleReq) requirementsText += `• Role Required: ${roleReq}\n`;
        if (!requirementsText) requirementsText = '• None';
        
        // Create giveaway embed
        const embed = new PremiumEmbed()
            .setTitle(`🎉 ${prize}`)
            .setDescription(
                `**Hosted by:** ${interaction.user}\n\n` +
                `**Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>\n` +
                `**Entries:** 0\n` +
                `**Winners:** ${winners}`
            )
            .addField('📋 Requirements', requirementsText)
            .setFooter({ text: `Giveaway ID: ${giveawayId} • Click the button below to enter!` });
        
        // Create enter button with unique custom ID
        const enterButton = new ButtonBuilder()
            .setCustomId(`giveaway_enter_${giveawayId}`)
            .setLabel('🎉 Enter Giveaway')
            .setStyle(ButtonStyle.Success);
        
        const row = new ActionRowBuilder().addComponents(enterButton);
        
        const giveawayMessage = await channel.send({ 
            embeds: [embed], 
            components: [row] 
        });
        
        // Save to database
        await GiveawayManager.createGiveaway({
            giveawayId,
            guildId: interaction.guild.id,
            channelId: channel.id,
            messageId: giveawayMessage.id,
            prize,
            winners,
            hostId: interaction.user.id,
            requirements: {
                xp: xpReq,
                invites: inviteReq,
                role: roleReq?.id || null
            },
            startTime: new Date(),
            endTime
        });
        
        // Store in memory
        client.giveaways.set(giveawayId, {
            messageId: giveawayMessage.id,
            channelId: channel.id,
            endTime: endTime.getTime(),
            winners,
            prize
        });
        
        // Schedule giveaway end
        setTimeout(() => {
            GiveawayManager.endGiveaway(giveawayId, client);
        }, finalDurationMs);
        
        const successEmbed = new PremiumEmbed()
            .setSuccess()
            .setTitle('✅ Giveaway Created!')
            .setDescription(`Giveaway created successfully in ${channel}`)
            .addField('🎁 Prize', prize, true)
            .addField('🆔 Giveaway ID', giveawayId, true)
            .addField('👑 Winners', winners.toString(), true)
            .addField('⏰ Ends', `<t:${Math.floor(endTime.getTime() / 1000)}:F>`, true)
            .addField('📋 Requirements', requirementsText);
        
        await interaction.editReply({ embeds: [successEmbed] });
        
        // Update guild stats
        const Guild = require('../../models/Guild');
        await Guild.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { $inc: { 'stats.totalGiveaways': 1 } },
            { upsert: true }
        );
    }
};
