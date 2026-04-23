const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const User = require('../../models/User');
const Giveaway = require('../../models/Giveaway');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xpgift')
        .setDescription('Create an XP gift that members can claim')
        .addIntegerOption(option =>
            option.setName('xp_amount')
                .setDescription('Amount of XP to gift')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(999999))
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('Specific user ID who can claim (optional)')
                .setRequired(false)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply();
        
        const xpAmount = interaction.options.getInteger('xp_amount');
        const specificUserId = interaction.options.getString('user_id');
        
        // Generate unique gift ID
        const giftId = Math.floor(10000 + Math.random() * 90000).toString();
        
        let restrictedTo = 'Anyone can claim';
        let targetUser = null;
        
        if (specificUserId && specificUserId.trim()) {
            try {
                targetUser = await interaction.client.users.fetch(specificUserId.trim());
                if (targetUser) {
                    restrictedTo = `${targetUser.tag} only`;
                }
            } catch (error) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Invalid User ID')
                    .setDescription('Could not find a user with that ID.');
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
        }
        
        // Create gift embed
        const giftEmbed = new PremiumEmbed()
            .setTitle('🎁 XP Gift Drop!')
            .setDescription(`A wild XP gift has appeared! Be the first to claim it!`)
            .addField('✨ XP Amount', `**${xpAmount.toLocaleString()}** XP`, true)
            .addField('🎯 Who Can Claim', restrictedTo, true)
            .addField('📊 Status', '🟢 Available', true)
            .addField('💡 How to Claim', 'Click the **Claim XP** button below!\nFirst come, first served!')
            .setFooter({ text: `Gift ID: ${giftId} • Created by ${interaction.user.tag}` })
            .setTimestamp();
        
        // Create claim button
        const claimButton = new ButtonBuilder()
            .setCustomId(`xpgift_claim_${giftId}`)
            .setLabel('Claim XP')
            .setStyle(ButtonStyle.Success);
            
        
        const row = new ActionRowBuilder().addComponents(claimButton);
        
        // Send gift message
        const giftMessage = await interaction.editReply({ 
            embeds: [giftEmbed], 
            components: [row]
        });
        
        // Create collector for the button
        const collector = giftMessage.createMessageComponentCollector({ 
            filter: i => i.customId === `xpgift_claim_${giftId}`,
            time: 604800000 // 7 days
        });
        
        collector.on('collect', async (i) => {
            // Check if restricted to specific user
            if (specificUserId && specificUserId.trim() && i.user.id !== specificUserId.trim()) {
                const restrictedEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Access Denied')
                    .setDescription(`This XP gift is reserved for ${targetUser?.tag || specificUserId} only!`);
                
                return i.reply({ embeds: [restrictedEmbed], ephemeral: true });
            }
            
            // Defer immediately
            await i.deferUpdate().catch(() => {});
            
            try {
                // Get current state from database
                const giftData = await Giveaway.findOne({ 
                    giveawayId: `xpgift_${giftId}`,
                    status: 'active'
                });
                
                if (!giftData || (giftData.xpGiftData && giftData.xpGiftData.claimed)) {
                    // Update UI to show claimed
                    const claimedEmbed = new PremiumEmbed()
                        .setWarning()
                        .setTitle('🎁 Already Claimed!')
                        .setDescription('This XP gift has already been claimed!');
                    
                    const disabledButton = new ButtonBuilder()
                        .setCustomId('xpgift_claimed')
                        .setLabel('Already Claimed')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                        .setEmoji('✅');
                    
                    const disabledRow = new ActionRowBuilder().addComponents(disabledButton);
                    
                    await giftMessage.edit({ embeds: [claimedEmbed], components: [disabledRow] });
                    
                    return i.followUp({ content: 'This gift has already been claimed!', ephemeral: true });
                }
                
                // Get claimer's current XP
                let claimerData = await User.findOne({ 
                    userId: i.user.id, 
                    guildId: interaction.guild.id 
                });
                
                const beforeXp = claimerData?.xp || 0;
                const beforeTotalXp = claimerData?.totalXp || 0;
                const beforeLevel = claimerData?.level || 1;
                
                // Update or create user
                if (!claimerData) {
                    claimerData = new User({
                        userId: i.user.id,
                        guildId: interaction.guild.id,
                        xp: xpAmount,
                        totalXp: xpAmount,
                        level: Math.floor(0.1 * Math.sqrt(xpAmount)),
                        messages: 0
                    });
                } else {
                    claimerData.xp = (claimerData.xp || 0) + xpAmount;
                    claimerData.totalXp = (claimerData.totalXp || 0) + xpAmount;
                    claimerData.level = Math.floor(0.1 * Math.sqrt(claimerData.totalXp));
                }
                
                await claimerData.save();
                
                const afterXp = claimerData.xp;
                const afterTotalXp = claimerData.totalXp;
                const afterLevel = claimerData.level;
                
                // Update gift data
                giftData.status = 'ended';
                giftData.xpGiftData = {
                    ...giftData.xpGiftData,
                    claimed: true,
                    claimedBy: i.user.id,
                    claimedAt: new Date()
                };
                giftData.entries.push({
                    userId: i.user.id,
                    username: i.user.username,
                    joinedAt: new Date()
                });
                giftData.winnersList.push({
                    userId: i.user.id,
                    username: i.user.username,
                    announcedAt: new Date()
                });
                
                await giftData.save();
                
                // Stop collector
                collector.stop('claimed');
                
                // Create claimed embed
                const claimedEmbed = new PremiumEmbed()
                    .setTitle('🎁 XP Gift Claimed!')
                    .setDescription(`This XP gift has been claimed by ${i.user}!`)
                    .addField('👤 Claimed By', `${i.user.tag}`, true)
                    .addField('🆔 User ID', i.user.id, true)
                    .addField('✨ XP Claimed', `${xpAmount.toLocaleString()} XP`, true)
                    .addField('📊 Claimer Stats',
                        `**Before:** ${beforeTotalXp.toLocaleString()} XP (Level ${beforeLevel})\n` +
                        `**After:** ${afterTotalXp.toLocaleString()} XP (Level ${afterLevel})\n` +
                        `**Gained:** +${xpAmount.toLocaleString()} XP`
                    )
                    .addField('⏰ Claimed At', `<t:${Math.floor(Date.now() / 1000)}:F>`)
                    .setFooter({ text: `Gift ID: ${giftId} • Created by ${interaction.user.tag}` })
                    .setThumbnail(i.user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();
                
                // Disable claim button
                const disabledButton = new ButtonBuilder()
                    .setCustomId('xpgift_claimed')
                    .setLabel('Already Claimed')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setEmoji('✅');
                
                const disabledRow = new ActionRowBuilder().addComponents(disabledButton);
                
                // Update the gift message
                await giftMessage.edit({ 
                    embeds: [claimedEmbed], 
                    components: [disabledRow] 
                });
                
                // Send public confirmation
                const confirmEmbed = new PremiumEmbed()
                    .setSuccess()
                    .setTitle('✅ XP Gift Claimed Successfully!')
                    .setDescription(`${i.user} has claimed **${xpAmount.toLocaleString()}** XP!`)
                    .addField('👤 Claimer', `${i.user.tag}`, true)
                    .addField('📊 XP Before', `${beforeTotalXp.toLocaleString()} XP (Level ${beforeLevel})`, true)
                    .addField('📈 XP After', `${afterTotalXp.toLocaleString()} XP (Level ${afterLevel})`, true)
                    .addField('⬆️ XP Gained', `+${xpAmount.toLocaleString()} XP`, true)
                    .addField('🎯 Level', `${beforeLevel} → ${afterLevel}`, true)
                    .setThumbnail(i.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: `Gift ID: ${giftId}` })
                    .setTimestamp();
                
                // Send public confirmation
                await interaction.channel.send({ 
                    content: `${i.user}`,
                    embeds: [confirmEmbed] 
                });
                
            } catch (error) {
                console.error('XP Gift Claim Error:', error);
                
                // Try to update UI even if error
                try {
                    const errorEmbed = new PremiumEmbed()
                        .setError()
                        .setTitle('❌ Claim Failed')
                        .setDescription('An error occurred. Please try again.');
                    
                    await i.followUp({ embeds: [errorEmbed], ephemeral: true });
                } catch (e) {
                    // Ignore follow-up errors
                }
            }
        });
        
        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                // Gift expired
                const expiredEmbed = new PremiumEmbed()
                    .setWarning()
                    .setTitle('⏰ XP Gift Expired')
                    .setDescription(`This XP gift has expired without being claimed!`)
                    .addField('✨ XP Amount', `${xpAmount.toLocaleString()} XP`, true)
                    .setFooter({ text: `Gift ID: ${giftId}` });
                
                const expiredButton = new ButtonBuilder()
                    .setCustomId('xpgift_expired')
                    .setLabel('Expired')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setEmoji('⏰');
                
                const expiredRow = new ActionRowBuilder().addComponents(expiredButton);
                
                await giftMessage.edit({ 
                    embeds: [expiredEmbed], 
                    components: [expiredRow] 
                }).catch(() => {});
                
                // Update database
                await Giveaway.findOneAndUpdate(
                    { giveawayId: `xpgift_${giftId}` },
                    { $set: { status: 'cancelled' } }
                ).catch(() => {});
            }
        });
    }
};
