const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addxp')
        .setDescription('Add XP to a user')
        .addStringOption(option =>
            option.setName('userid')
                .setDescription('The User ID to add XP to')
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
        
        const userId = interaction.options.getString('userid');
        const amount = interaction.options.getInteger('amount');
        
        try {
            // Try to fetch user
            const target = await interaction.client.users.fetch(userId).catch(() => null);
            
            if (!target) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Invalid User ID')
                    .setDescription('Could not find a user with that ID.');
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            const userData = await User.findOneAndUpdate(
                { userId: userId, guildId: interaction.guild.id },
                { 
                    $inc: { 
                        xp: amount,
                        totalXp: amount 
                    },
                    $setOnInsert: { 
                        userId: userId, 
                        guildId: interaction.guild.id 
                    }
                },
                { 
                    upsert: true, 
                    new: true,
                    setDefaultsOnInsert: true 
                }
            );
            
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
                .addField('👤 User', `${target}`, true)
                .addField('🆔 User ID', userId, true)
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
