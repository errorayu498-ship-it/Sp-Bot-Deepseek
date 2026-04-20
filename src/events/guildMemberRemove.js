const { logger } = require('../utils/logger');
const User = require('../models/User');
const Guild = require('../models/Guild');
const { EmbedBuilder } = require('discord.js');

async function sendLog(guild, channelId, embed) {
    if (!channelId) return;
    
    try {
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (channel) {
            await channel.send({ embeds: [embed] }).catch(() => {});
        }
    } catch (error) {
        logger.error('Failed to send log:', error);
    }
}

module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        try {
            const guildData = await Guild.findOne({ guildId: member.guild.id });
            
            // Update inviter's stats (mark as left)
            const userData = await User.findOne({ 
                userId: member.id, 
                guildId: member.guild.id 
            });
            
            // Find who invited this user
            const inviterData = await User.findOne({
                guildId: member.guild.id,
                'invitedUsers.userId': member.id
            });
            
            if (inviterData) {
                const invitedUser = inviterData.invitedUsers.find(u => u.userId === member.id);
                if (invitedUser && invitedUser.isValid) {
                    invitedUser.isValid = false;
                    invitedUser.leftAt = new Date();
                    
                    inviterData.invites.total = Math.max(0, inviterData.invites.total - 1);
                    inviterData.invites.leaves += 1;
                    
                    await inviterData.save();
                }
            }
            
            // Send leave log
            if (guildData?.settings?.logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Member Left')
                    .setDescription(`${member.user.tag} left the server!`)
                    .addFields(
                        { name: 'User', value: `${member.user.tag}`, inline: true },
                        { name: 'ID', value: member.id, inline: true },
                        { name: 'Joined At', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
                        { name: 'Total Members', value: `${member.guild.memberCount}`, inline: true }
                    )
                    .setTimestamp();
                
                if (inviterData) {
                    const inviter = await client.users.fetch(inviterData.userId).catch(() => null);
                    if (inviter) {
                        logEmbed.addFields(
                            { name: 'Invited By', value: inviter.tag, inline: true }
                        );
                    }
                }
                
                await sendLog(member.guild, guildData.settings.logChannel, logEmbed);
            }
            
            // Send invite log for leave
            if (guildData?.settings?.inviteLogChannel && inviterData) {
                const inviter = await client.users.fetch(inviterData.userId).catch(() => null);
                if (inviter) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle('📨 Member Left - Invite Log')
                        .setDescription(`${member.user.tag} left the server!`)
                        .addFields(
                            { name: 'User', value: `${member.user.tag}`, inline: true },
                            { name: 'Invited By', value: inviter.tag, inline: true },
                            { name: 'Inviter Current Invites', value: `${inviterData.invites.total}`, inline: true },
                            { name: 'Total Leaves from Inviter', value: `${inviterData.invites.leaves}`, inline: true }
                        )
                        .setTimestamp();
                    
                    await sendLog(member.guild, guildData.settings.inviteLogChannel, logEmbed);
                }
            }
            
        } catch (error) {
            logger.error('Guild Member Remove Error:', error);
        }
    }
};
