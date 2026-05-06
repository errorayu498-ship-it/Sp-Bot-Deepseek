const { SlashCommandBuilder, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const { GiveawayManager } = require('../../utils/giveawayManager');
const { EmojiHelper } = require('../../utils/emojiHelper');
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
        let duration = interaction.options.getString('duration') || '24h';
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const xpReq = interaction.options.getInteger('xp_requirement') || 0;
        const inviteReq = interaction.options.getInteger('invite_requirement') || 0;
        const roleReq = interaction.options.getRole('role_requirement');
        
        // Parse duration
        const durationMs = ms(duration);
        if (!durationMs || durationMs < 60000) {
            duration = '24h';
        }
        
        const finalDurationMs = ms(duration) || 86400000;
        const endTime = new Date(Date.now() + finalDurationMs);
        const giveawayId = Math.floor(1000 + Math.random() * 9000).toString();
        
        // Requirements display with custom emojis
        let requirementsText = '';
        if (xpReq > 0) requirementsText += `${EmojiHelper.get('xp.earn')} XP Required: **${xpReq}**\n`;
        if (inviteReq > 0) requirementsText += `${EmojiHelper.get('invite.check')} Invites Required: **${inviteReq}**\n`;
        if (roleReq) requirementsText += `${EmojiHelper.get('admin.roles')} Role Required: **${roleReq}**\n`;
        if (!requirementsText) requirementsText = `${EmojiHelper.get('status.enabled')} None`;
        
        // Create giveaway embed with custom emojis
        const embed = new PremiumEmbed()
            .setTitle(`${EmojiHelper.get('giveaway.create')} ${prize}`)
            .setDescription(
                `${EmojiHelper.get('giveaway.host')} **Hosted by:** ${interaction.user}\n\n` +
                `${EmojiHelper.get('giveaway.timer')} **Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>\n` +
                `${EmojiHelper.get('giveaway.entries')} **Entries:** 0\n` +
                `${EmojiHelper.get('giveaway.winner')} **Winners:** ${winners}`
            )
            .addField(`${EmojiHelper.get('giveaway.requirements')} Requirements`, requirementsText)
            .setFooter({ text: `Giveaway ID: ${giveawayId} • Click the button below to enter!` });
        
        const enterButton = new ButtonBuilder()
            .setCustomId(`giveaway_enter_${giveawayId}`)
            .setLabel(`${EmojiHelper.get('giveaway.enter')} Enter Giveaway`)
            .setStyle(ButtonStyle.Success);
        
        const row = new ActionRowBuilder().addComponents(enterButton);
        
        const giveawayMessage = await channel.send({ 
            embeds: [embed], 
            components: [row] 
        });
        
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
        
        client.giveaways.set(giveawayId, {
            messageId: giveawayMessage.id,
            channelId: channel.id,
            endTime: endTime.getTime(),
            winners,
            prize
        });
        
        setTimeout(() => {
            GiveawayManager.endGiveaway(giveawayId, client);
        }, finalDurationMs);
        
        const successEmbed = new PremiumEmbed()
            .setSuccess()
            .setTitle(`${EmojiHelper.get('response.success')} Giveaway Created!`)
            .setDescription(`Giveaway created successfully in ${channel}`)
            .addField(`${EmojiHelper.get('giveaway.prize')} Prize`, prize, true)
            .addField(`${EmojiHelper.get('misc.id')} Giveaway ID`, giveawayId, true)
            .addField(`${EmojiHelper.get('giveaway.winner')} Winners`, winners.toString(), true)
            .addField(`${EmojiHelper.get('giveaway.timer')} Ends`, `<t:${Math.floor(endTime.getTime() / 1000)}:F>`, true)
            .addField(`${EmojiHelper.get('giveaway.requirements')} Requirements`, requirementsText);
        
        await interaction.editReply({ embeds: [successEmbed] });
        
        const Guild = require('../../models/Guild');
        await Guild.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { $inc: { 'stats.totalGiveaways': 1 } },
            { upsert: true }
        );
    }
};
