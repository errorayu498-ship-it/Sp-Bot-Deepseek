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
        
        try {
            // Use findOneAndUpdate with upsert to avoid duplicate key errors
            const userData = await User.findOneAndUpdate(
                { userId: target.id, guildId: interaction.guild.id },
                { 
                    $setOnInsert: { 
                        userId: target.id, 
                        guildId: interaction.guild.id 
                    },
                    $inc: { 
                        xp: amount,
                        totalXp: amount 
                    }
                },
                { 
                    upsert: true, 
                    new: true,
                    setDefaultsOnInsert: true 
                }
            );
            
            // Recalculate level
            const newLevel = Math.floor(0.1 * Math.sqrt(userData.totalXp));
            const oldLevel = userData.level;
            
            if (newLevel !== oldLevel) {
                userData.level = newLevel;
                await userData.save();
            }
            
            const embed = new PremiumEmbed()
                .setSuccess()
                .setTitle('✅ XP Added')
                .setDescription(`Added **${amount}** XP to ${target.tag}`)
                .addField('📊 New XP', userData.xp.toLocaleString(), true)
                .addField('💫 Total XP', userData.totalXp.toLocaleString(), true)
                .addField('📈 Level', `${oldLevel} → ${newLevel}`, true)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }));
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('AddXP Error:', error);
            
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Error')
                .setDescription('Failed to add XP. Please try again.');
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
