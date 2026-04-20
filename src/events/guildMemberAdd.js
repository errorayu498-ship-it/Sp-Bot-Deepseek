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
    name: 'guildMemberAdd',
    async execute(member, client) {
        try {
            const guildData = await Guild.findOne({ guildId: member.guild.id });
            
            // Track invites
            const newInvites = await member.guild.invites.fetch().catch(() => null);
            const oldInvites = client.invites.get(member.guild.id);
            
            let inviterData = null;
            let usedInvite = null;
            
            if (oldInvites && newInvites) {
                usedInvite = newInvites.find(inv => {
                    const oldUses = oldInvites.get(inv.code);
                    return oldUses !== undefined && inv.uses > oldUses;
                });
                
                if (usedInvite && usedInvite.inviter) {
                    const inviterId = usedInvite.inviter.id;
                    
                    let inviterUserData = await User.findOne({ 
                        userId: inviterId, 
                        guildId: member.guild.id 
                    });
                    
                    if (!inviterUserData) {
                        inviterUserData = new User({
                            userId: inviterId,
                            guildId: member.guild.id
                        });
                    }
                    
                    inviterUserData.invites.total += 1;
                    inviterUserData.invites.regular += 1;
                    
                    inviterUserData.invitedUsers.push({
                        userId: member.id,
                        joinedAt: new Date(),
                        isValid: true
                    });
                    
                    await inviterUserData.save();
                    inviterData = inviterUserData;
                    
                    logger.info(`${member.user.username} was invited by ${usedInvite.inviter.username}`);


                
            // Update invite cache
            if (newInvites) {
                client.invites.set(member.guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));
            }
            
            // Send invite log
            if (guildData?.settings?.inviteLogChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('📨 Member Joined - Invite Log')
                    .setDescription(`${member.user} joined the server!`)
                    .addFields(
                        { name: 'User', value: `${member.user.tag}`, inline: true },
                        { name: 'User ID', value: member.id, inline: true },
                        { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                    );
                
                if (usedInvite && usedInvite.inviter) {
                    logEmbed.addFields(
                        { name: 'Invited By', value: `${usedInvite.inviter.tag}`, inline: true },
                        { name: 'Invite Code', value: usedInvite.code, inline: true },
                        { name: 'Invite Uses', value: `${usedInvite.uses}`, inline: true }
                    );
                    
                    if (inviterData) {
                        logEmbed.addFields(
                            { name: 'Inviter Total Invites', value: `${inviterData.invites.total}`, inline: true }
                        );
                    }
                } else {
                    logEmbed.addFields(
                        { name: 'Invited By', value: 'Unknown/Vanity URL', inline: true }
                    );
                }
                
                logEmbed.setTimestamp()
                    .setFooter({ text: `Member #${member.guild.memberCount}` });
                
                await sendLog(member.guild, guildData.settings.inviteLogChannel, logEmbed);
            }
            
            // Send general log
            if (guildData?.settings?.logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Member Joined')
                    .setDescription(`${member.user} joined the server!`)
                    .addFields(
                        { name: 'User', value: `${member.user.tag}`, inline: true },
                        { name: 'ID', value: member.id, inline: true },
                        { name: 'Total Members', value: `${member.guild.memberCount}`, inline: true }
                    )
                    .setTimestamp();
                
                await sendLog(member.guild, guildData.settings.logChannel, logEmbed);
            }
            
        } catch (error) {
            logger.error('Guild Member Add Error:', error);
        }
    }
};
