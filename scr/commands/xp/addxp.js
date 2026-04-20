const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addxp')
        .setDescription('Add XP to a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to add XP to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of XP to add')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100000)),
    
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
            userData = new User({
                userId: target.id,
                guildId: interaction.guild.id
            });
        }
        
        const oldLevel = userData.level;
        
        userData.xp += amount;
        userData.totalXp += amount;
        
        const newLevel = Math.floor(0.1 * Math.sqrt(userData.totalXp));
        userData.level = newLevel;
        
        await userData.save();
        
        const embed = new PremiumEmbed()
            .setSuccess()
            .setTitle('XP Added')
            .setDescription(`Added ${amount} XP to ${target.tag}`)
            .addField('New XP', userData.xp.toString(), true)
            .addField('Total XP', userData.totalXp.toString(), true)
            .addField('Level', `${oldLevel} → ${newLevel}`, true);
        
        await interaction.editReply({ embeds: [embed] });
    }
};
