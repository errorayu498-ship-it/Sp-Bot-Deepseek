const { logger } = require('../utils/logger');
const User = require('../models/User');
const { PremiumEmbed } = require('../utils/embedBuilder');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        try {
            // Track invites
            const newInvites = await member.guild.invites.fetch();
            const oldInvites = client.invites.get(member.guild.id);
            
            if (oldInvites) {
                const usedInvite = newInvites.find(inv => {
                    const oldUses = oldInvites.get(inv.code);
                    return oldUses !== undefined && inv.uses > oldUses;
                });
                
                if (usedInvite && usedInvite.inviter) {
                    const inviterId = usedInvite.inviter.id;
                    
                    // Update inviter's stats
                    let inviterData = await User.findOne({ 
                        userId: inviterId, 
                        guildId: member.guild.id 
                    });
                    
                    if (!inviterData) {
                        inviterData = new User({
                            userId: inviterId,
                            guildId: member.guild.id
                        });
                    }
                    
                    inviterData.invites.total += 1;
                    inviterData.invites.regular += 1;
                    
                    inviterData.invitedUsers.push({
                        userId: member.id,
                        joinedAt: new Date(),
                        isValid: true
                    });
                    
                    await inviterData.save();
                    
                    logger.info(`${member.user.username} was invited by ${usedInvite.inviter.username}`);
                    
                    // Send welcome message to inviter
                    try {
                        const inviter = await member.guild.members.fetch(inviterId);
                        if (inviter) {
                            const embed = new PremiumEmbed()
                                .setSuccess()
                                .setTitle('🎉 New Member Invited!')
                                .setDescription(`${member.user} joined using your invite!`)
                                .addField('Total Invites', inviterData.invites.total.toString(), true)
                                .addField('Regular Invites', inviterData.invites.regular.toString(), true)
                                .setFooter({ text: 'Keep inviting to earn rewards!' });
                            
                            await inviter.send({ embeds: [embed] }).catch(() => {});
                        }
                    } catch (error) {
                        logger.debug('Could not send DM to inviter');
                    }
                }
            }
            
            // Update invite cache
            client.invites.set(member.guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));
            
        } catch (error) {
            logger.error('Guild Member Add Error:', error);
        }
    }
};
