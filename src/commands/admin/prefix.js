const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const Guild = require('../../models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prefix')
        .setDescription('Change the bot prefix')
        .addStringOption(option =>
            option.setName('new_prefix')
                .setDescription('The new prefix to use')
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(5)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const newPrefix = interaction.options.getString('new_prefix');
        
        // Validate prefix
        const invalidPrefixes = ['/', '\\', '@', '#', '*', '`', '~'];
        if (invalidPrefixes.includes(newPrefix)) {
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Invalid Prefix')
                .setDescription(`The prefix \`${newPrefix}\` is not allowed as it may conflict with Discord formatting.`)
                .addField('Allowed Characters', 'Letters, numbers, and most symbols except: / \\ @ # * ` ~');
            
            return interaction.editReply({ embeds: [errorEmbed] });
        }
        
        await Guild.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { $set: { 'settings.prefix': newPrefix } },
            { upsert: true }
        );
        
        const successEmbed = new PremiumEmbed()
            .setSuccess()
            .setTitle('✅ Prefix Updated!')
            .setDescription(`Bot prefix has been changed to \`${newPrefix}\``)
            .addField('📝 New Commands Format', 
                `• \`${newPrefix}xp\` - Check XP\n` +
                `• \`${newPrefix}leaderboard\` - XP Leaderboard\n` +
                `• \`${newPrefix}invite\` - Check invites\n` +
                `• \`${newPrefix}help\` - Help menu`)
            .setFooter({ text: 'Changes applied immediately!' });
        
        await interaction.editReply({ embeds: [successEmbed] });
    }
};
