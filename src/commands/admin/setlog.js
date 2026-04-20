const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const Guild = require('../../models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setlog')
        .setDescription('Set logging channels for the bot')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of log channel to set')
                .setRequired(true)
                .addChoices(
                    { name: 'General Logs', value: 'log' },
                    { name: 'Invite Logs', value: 'invite' },
                    { name: 'XP Channel', value: 'xp' },
                    { name: 'Level Up Channel', value: 'levelup' }
                ))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send logs to')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const type = interaction.options.getString('type');
        const channel = interaction.options.getChannel('channel');
        
        const updateData = {};
        let typeName = '';
        
        switch(type) {
            case 'log':
                updateData['settings.logChannel'] = channel.id;
                typeName = 'General Logs';
                break;
            case 'invite':
                updateData['settings.inviteLogChannel'] = channel.id;
                typeName = 'Invite Logs';
                break;
            case 'xp':
                updateData['settings.xpChannel'] = channel.id;
                typeName = 'XP Channel';
                break;
            case 'levelup':
                updateData['settings.levelUpChannel'] = channel.id;
                typeName = 'Level Up Channel';
                break;
        }
        
        await Guild.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { $set: updateData },
            { upsert: true }
        );
        
        const embed = new PremiumEmbed()
            .setSuccess()
            .setTitle('✅ Log Channel Set!')
            .setDescription(`${typeName} has been set to ${channel}`)
            .addField('Channel', `${channel}`, true)
            .addField('Type', typeName, true);
        
        await interaction.editReply({ embeds: [embed] });
        
        // Send test log
        const testEmbed = new PremiumEmbed()
            .setSuccess()
            .setTitle('📝 Log Channel Configured')
            .setDescription(`This channel is now configured for **${typeName}**!`)
            .addField('Set By', `${interaction.user}`, true)
            .addField('Channel ID', channel.id, true)
            .setTimestamp();
        
        await channel.send({ embeds: [testEmbed] }).catch(() => {});
    }
};
