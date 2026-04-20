const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removexp')
        .setDescription('Remove XP from a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove XP from')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of XP to remove')
                .setRequired(true)
                .setMinValue(1)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        
        let userData = await User.findOne({ 
            userId: target.id, 
            guildId: interaction.guild.id 
        });
        
        if (!userData) {
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('User Not Found')
                .setDescription('This user has no XP data.');
            
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
            .setTitle('XP Removed')
            .setDescription(`Removed ${amount} XP from ${target.tag}`)
            .addField('New XP', userData.xp.toString(), true)
            .addField('Total XP', userData.totalXp.toString(), true)
            .addField('Level', `${oldLevel} → ${newLevel}`, true);
        
        await interaction.editReply({ embeds: [embed] });
    }
};
