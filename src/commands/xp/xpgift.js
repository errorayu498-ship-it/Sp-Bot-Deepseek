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
                .setMaxValue(99999999))
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('Specific user ID who can claim (optional - leave empty for anyone)')
                .setRequired(false)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply();
        
        const xpAmount = interaction.options.getInteger('xp_amount');
        const specificUserId = interaction.options.getString('user_id');
        
        // Generate unique gift ID
        const giftId = Math.floor(1000 + Math.random() * 9000).toString();
        
        let restrictedTo = 'Anyone';
        let targetUser = null;
        
        if (specificUserId) {
            try {
                targetUser = await interaction.client.users.fetch(specificUserId);
                restrictedTo = `${targetUser.tag}`;
            } catch (error) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Invalid User ID')
                    .setDescription('Could not find a user with that ID. Make sure the ID is correct.');
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
        }
        
        // Create gift embed
        const giftEmbed = new PremiumEmbed()
            .setTitle('🎁 XP Gift Drop!')
            .setDescription(`A wild XP gift has appeared! Be the first to claim it!`)
            .addField('✨ XP Amount', `**${xpAmount.toLocaleString()}** XP`, true)
            .addField('🎯 Restricted To', `${restrictedTo}`, true)
            .addField('📊 Status', '🟢 Available', true)
            .addField('💡 How to Claim', 'Click the **Claim XP** button below!\nFirst come, first served!')
            .setFooter({ text: `Gift ID: ${giftId} • Created by ${interaction.user.tag}` })
            .setTimestamp();
        
        // Create claim button
        const claimButton = new ButtonBuilder()
            .setCustomId(`xpgift_claim_${giftId}`)
            .setLabel('Claim XP')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎁');
        
        const row = new ActionRowBuilder().addComponents(claimButton);
        
        // Send gift message
        const giftMessage = await interaction.editReply({ 
            embeds: [giftEmbed], 
            components: [row]
        });
        
        // Store gift data in database
        const giftData = new Giveaway({
            giveawayId: `xpgift_${giftId}`,
            guildId: interaction.guild.id,
            channelId: interaction.channel.id,
            messageId: giftMessage.id,
            prize: `XP Gift - ${xpAmount} XP`,
            winners: 1,
            hostId: interaction.user.id,
            requirements: {
                xp: 0,
                invites: 0,
                role: null
            },
            entries: [],
            winnersList: [],
            startTime: new Date(),
            endTime: new Date(Date.now() + 604800000), // 7 days
            status: 'active',
            rerollCount: 0,
            xpGiftData: {
                xpAmount: xpAmount,
                specificUserId: specificUserId || null,
                claimed: false,
                claimedBy: null,
                claimedAt: null
            }
        });
        
        await giftData.save();
        
        // Create button collector for the gift
        const collector = giftMessage.createMessageComponentCollector({ 
            filter: i => i.customId === `xpgift_claim_${giftId}`,
            time: 604800000 // 7 days
        });
        
        collector.on('collect', async (i) => {
            // Check if already claimed
            const updatedGift = await Giveaway.findOne({ giveawayId: `xpgift_${giftId}` });
            
            if (!updatedGift || updatedGift.xpGiftData.claimed) {
                return i.reply({ 
                    content: 'This XP gift has already been claimed!', 
                    ephemeral: true 
                });
            }
            
            // Check if restricted to specific user
            if (specificUserId && i.user.id !== specificUserId) {
                const restrictedEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Access Denied')
                    .setDescription(`This XP gift is reserved for ${targetUser.tag} only!`);
                
                return i.reply({ embeds: [restrictedEmbed], ephemeral: true });
            }
            
            // Defer reply to prevent interaction timeout
            await i.deferUpdate();
            
            try {
                // Get claimer's current XP data
                let claimerData = await User.findOne({ 
                    userId: i.user.id, 
                    guildId: interaction.guild.id 
                });
                
                const beforeXp = claimerData?.xp || 0;
                const beforeTotalXp = claimerData?.totalXp || 0;
                const beforeLevel = claimerData?.level || 1;
                
                // Update or create user data
                if (!claimerData) {
                    claimerData = new User({
                        userId: i.user.id,
                        guildId: interaction.guild.id,
                        xp: xpAmount,
                        totalXp: xpAmount,
                        level: Math.floor(0.1 * Math.sqrt(xpAmount))
                    });
                } else {
                    claimerData.xp += xpAmount;
                    claimerData.totalXp += xpAmount;
                    claimerData.level = Math.floor(0.1 * Math.sqrt(claimerData.totalXp));
                }
                
                await claimerData.save();
                
                const afterXp = claimerData.xp;
                const afterTotalXp = claimerData.totalXp;
                const afterLevel = claimerData.level;
                
                // Update gift data
                updatedGift.xpGiftData.claimed = true;
                updatedGift.xpGiftData.claimedBy = i.user.id;
                updatedGift.xpGiftData.claimedAt = new Date();
                updatedGift.status = 'ended';
                updatedGift.entries.push({
                    userId: i.user.id,
                    username: i.user.username,
                    joinedAt: new Date()
                });
                updatedGift.winnersList.push({
                    userId: i.user.id,
                    username: i.user.username,
                    announcedAt: new Date()
                });
                
                await updatedGift.save();
                
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
                
                // Send claim confirmation message
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
                
                // Log the claim if log channel is set
                const Guild = require('../../models/Guild');
                const guildData = await Guild.findOne({ guildId: interaction.guild.id });
                
                if (guildData?.settings?.logChannel) {
                    const { EmbedBuilder } = require('discord.js');
                    const logEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('🎁 XP Gift Claimed - Log')
                        .setDescription(`An XP gift was claimed!`)
                        .addFields(
                            { name: 'Claimed By', value: `${i.user.tag}`, inline: true },
                            { name: 'User ID', value: i.user.id, inline: true },
                            { name: 'XP Amount', value: `${xpAmount.toLocaleString()}`, inline: true },
                            { name: 'Gift ID', value: giftId, inline: true },
                            { name: 'Created By', value: `${interaction.user.tag}`, inline: true }
                        )
                        .setTimestamp();
                    
                    const logChannel = await interaction.guild.channels.fetch(guildData.settings.logChannel).catch(() => null);
                    if (logChannel) {
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                }
                
                // Stop collector
                collector.stop('claimed');
                
            } catch (error) {
                console.error('XP Gift Claim Error:', error);
                
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Claim Failed')
                    .setDescription('An error occurred while claiming the XP gift. Please try again.');
                
                await interaction.channel.send({ 
                    content: `${i.user}`,
                    embeds: [errorEmbed] 
                });
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
                );
            }
        });
    }
};
