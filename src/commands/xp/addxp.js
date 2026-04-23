const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addxp')
        .setDescription('Add XP to a user by User ID')
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
        
        const userId = interaction.options.getString('userid').trim();
        const amount = interaction.options.getInteger('amount');
        
        try {
            // Try to fetch user from Discord
            const target = await interaction.client.users.fetch(userId).catch(() => null);
            
            if (!target) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Invalid User ID')
                    .setDescription(`Could not find a user with ID: \`${userId}\`\n\nMake sure:\n• The ID is correct\n• The user shares a server with the bot`);
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Check if user exists in guild
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            
            // Find or create user in database
            let userData = await User.findOne({ 
                userId: userId, 
                guildId: interaction.guild.id 
            });
            
            const oldLevel = userData?.level || 1;
            const oldXp = userData?.xp || 0;
            const oldTotalXp = userData?.totalXp || 0;
            
            // Update using findOneAndUpdate with upsert
            userData = await User.findOneAndUpdate(
                { userId: userId, guildId: interaction.guild.id },
                { 
                    $inc: { 
                        xp: amount,
                        totalXp: amount 
                    },
                    $setOnInsert: { 
                        userId: userId, 
                        guildId: interaction.guild.id,
                        level: 1,
                        messages: 0
                    }
                },
                { 
                    upsert: true, 
                    new: true,
                    setDefaultsOnInsert: true,
                    runValidators: true
                }
            );
            
            // Recalculate level
            const newLevel = Math.floor(0.1 * Math.sqrt(userData.totalXp));
            
            if (newLevel !== userData.level) {
                userData.level = newLevel;
                await userData.save();
            }
            
            const newXp = userData.xp;
            const newTotalXp = userData.totalXp;
            
            const embed = new PremiumEmbed()
                .setSuccess()
                .setTitle('✅ XP Added Successfully')
                .setDescription(`Added **${amount.toLocaleString()}** XP to ${target.tag}`)
                .addField('👤 User', `${target}`, true)
                .addField('🆔 User ID', userId, true)
                .addField('📊 XP Before', oldTotalXp.toLocaleString(), true)
                .addField('📈 XP After', newTotalXp.toLocaleString(), true)
                .addField('⬆️ XP Gained', `+${amount.toLocaleString()}`, true)
                .addField('🎯 Level', `${oldLevel} → ${newLevel}`, true)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `Added by ${interaction.user.tag}` })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('AddXP Error:', error);
            
            // If duplicate key error, retry with find then update
            if (error.code === 11000) {
                try {
                    let userData = await User.findOne({ userId: userId, guildId: interaction.guild.id });
                    
                    if (!userData) {
                        userData = new User({
                            userId: userId,
                            guildId: interaction.guild.id,
                            xp: amount,
                            totalXp: amount,
                            level: Math.floor(0.1 * Math.sqrt(amount))
                        });
                    } else {
                        userData.xp += amount;
                        userData.totalXp += amount;
                        userData.level = Math.floor(0.1 * Math.sqrt(userData.totalXp));
                    }
                    
                    await userData.save();
                    
                    const target = await interaction.client.users.fetch(userId).catch(() => null);
                    
                    const embed = new PremiumEmbed()
                        .setSuccess()
                        .setTitle('✅ XP Added Successfully')
                        .setDescription(`Added **${amount.toLocaleString()}** XP to ${target?.tag || userId}`)
                        .addField('👤 User', target ? `${target}` : 'Unknown', true)
                        .addField('🆔 User ID', userId, true)
                        .addField('📈 New Total XP', userData.totalXp.toLocaleString(), true)
                        .addField('🎯 New Level', `${userData.level}`, true);
                    
                    if (target) {
                        embed.setThumbnail(target.displayAvatarURL({ dynamic: true }));
                    }
                    
                    await interaction.editReply({ embeds: [embed] });
                    
                } catch (retryError) {
                    console.error('AddXP Retry Error:', retryError);
                    
                    const errorEmbed = new PremiumEmbed()
                        .setError()
                        .setTitle('❌ Error')
                        .setDescription('Failed to add XP after retry. Please try again.');
                    
                    await interaction.editReply({ embeds: [errorEmbed] });
                }
            } else {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Error')
                    .setDescription(`Failed to add XP: ${error.message}`);
                
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        }
    }
};
