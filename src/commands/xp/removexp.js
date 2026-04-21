const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removexp')
        .setDescription('Remove XP from a user')
        .addStringOption(option =>
            option.setName('userid')
                .setDescription('The User ID to remove XP from')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of XP to remove')
                .setRequired(true)
                .setMinValue(1)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const userId = interaction.options.getString('userid');
        const amount = interaction.options.getInteger('amount');
        
        try {
            const target = await interaction.client.users.fetch(userId).catch(() => null);
            
            let userData = await User.findOne({ 
                userId: userId, 
                guildId: interaction.guild.id 
            });
            
            if (!userData) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ User Not Found')
                    .setDescription('This user has no XP data in this server.');
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            const oldLevel = userData.level;
            
            userData.xp = Math.max(0, userData.xp - amount);
            userData.totalXp = Math.max(0, userData.totalXp - amount);
            
            const newLevel = Math.floor(0.1 * Math.sqrt(userData.totalXp));
            userData.level = newLevel;
            
            await userData.save();
            
            const embed = new PremiumEmbed()
                .setWarning()
                .setTitle('⬇️ XP Removed')
                .setDescription(`Removed **${amount}** XP from ${target?.tag || userId}`)
                .addField('👤 User', target ? `${target}` : 'Unknown User', true)
                .addField('🆔 User ID', userId, true)
                .addField('📊 New XP', userData.xp.toLocaleString(), true)
                .addField('💫 Total XP', userData.totalXp.toLocaleString(), true)
                .addField('📈 Level', `${oldLevel} → ${newLevel}`, true);
            
            if (target) {
                embed.setThumbnail(target.displayAvatarURL({ dynamic: true }));
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('RemoveXP Error:', error);
            
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Error')
                .setDescription('Failed to remove XP. Please try again.');
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
