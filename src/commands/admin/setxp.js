const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const Guild = require('../../models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setxp')
        .setDescription('Configure XP system settings')
        .addSubcommand(sub =>
            sub.setName('channel')
                .setDescription('Set the channel where XP can be earned')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel for XP earning')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable or disable the XP system')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable XP system')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('amount')
                .setDescription('Set XP amount per message')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('XP per message (1-100)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(100)))
        .addSubcommand(sub =>
            sub.setName('cooldown')
                .setDescription('Set XP cooldown in seconds')
                .addIntegerOption(option =>
                    option.setName('seconds')
                        .setDescription('Cooldown in seconds (10-300)')
                        .setRequired(true)
                        .setMinValue(10)
                        .setMaxValue(300))),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const subcommand = interaction.options.getSubcommand();
        const guildData = await Guild.findOne({ guildId: interaction.guild.id });
        
        let updateData = {};
        let responseMessage = '';
        
        switch(subcommand) {
            case 'channel':
                const channel = interaction.options.getChannel('channel');
                updateData['settings.xpChannel'] = channel.id;
                responseMessage = `XP channel set to ${channel}`;
                break;
                
            case 'toggle':
                const enabled = interaction.options.getBoolean('enabled');
                updateData['settings.xpEnabled'] = enabled;
                responseMessage = `XP system ${enabled ? 'enabled' : 'disabled'}`;
                break;
                
            case 'amount':
                const amount = interaction.options.getInteger('amount');
                updateData['settings.xpPerMessage'] = amount;
                responseMessage = `XP per message set to ${amount}`;
                break;
                
            case 'cooldown':
                const cooldown = interaction.options.getInteger('seconds');
                updateData['settings.xpCooldown'] = cooldown;
                responseMessage = `XP cooldown set to ${cooldown} seconds`;
                break;
        }
        
        await Guild.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { $set: updateData },
            { upsert: true }
        );
        
        const embed = new PremiumEmbed()
            .setSuccess()
            .setTitle('✅ XP Settings Updated!')
            .setDescription(responseMessage)
            .addField('Current Settings',
                `**XP Channel:** ${updateData['settings.xpChannel'] ? `<#${updateData['settings.xpChannel']}>` : guildData?.settings?.xpChannel ? `<#${guildData.settings.xpChannel}>` : 'Not Set'}\n` +
                `**XP Enabled:** ${updateData['settings.xpEnabled'] ?? guildData?.settings?.xpEnabled ?? true}\n` +
                `**XP Per Message:** ${updateData['settings.xpPerMessage'] ?? guildData?.settings?.xpPerMessage ?? 5}\n` +
                `**Cooldown:** ${updateData['settings.xpCooldown'] ?? guildData?.settings?.xpCooldown ?? 60} seconds`
            );
        
        await interaction.editReply({ embeds: [embed] });
    }
};
