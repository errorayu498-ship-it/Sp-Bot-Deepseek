const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const Guild = require('../../models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antispam')
        .setDescription('Toggle anti-spam system for XP channel')
        .addBooleanOption(option =>
            option.setName('enabled')
                .setDescription('Enable or disable anti-spam')
                .setRequired(true)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const enabled = interaction.options.getBoolean('enabled');
        
        await Guild.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { $set: { 'settings.antiSpamEnabled': enabled } },
            { upsert: true }
        );
        
        const embed = new PremiumEmbed()
            .setSuccess()
            .setTitle('✅ Anti-Spam Updated')
            .setDescription(`Anti-spam system is now **${enabled ? 'ENABLED' : 'DISABLED'}**`)
            .addField('Status', enabled ? '🟢 Active' : '🔴 Inactive', true)
            .addField('Threshold', '3 repeated messages', true)
            .addField('Action', 'Delete message + Warning', true)
            .setFooter({ text: `Changed by ${interaction.user.tag}` });
        
        await interaction.editReply({ embeds: [embed] });
    }
};
