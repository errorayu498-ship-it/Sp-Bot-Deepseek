// =====================================================
// CUSTOM EMOJIS CONFIGURATION
// =====================================================
// Yahan aap apne custom emojis set kar sakte hain
// Emoji ID ya standard emoji use karein
// 
// Format:
// <:emoji_name:emoji_id> - Custom Discord Emoji
// 🎉 - Standard Emoji
//
// Example:
// success: '<:success:123456789012345678>',
// error: '<:error:123456789012345678>',
// 
// Custom emoji ID lene ke liye:
// 1. Discord mein emoji type karein
// 2. Emoji ke aage \ (backslash) lagayein
// 3. Send karein to ID mil jayegi
//    Example: <:emoji_name:123456789012345678>
// =====================================================

module.exports = {
    // ==================== GIVEAWAY EMOJIS ====================
    giveaway: {
        create: '🎉',              // /cgw command
        enter: '🎉',               // Enter giveaway button
        ended: '🏁',               // Giveaway ended
        cancelled: '❌',           // Giveaway cancelled
        winner: '👑',              // Winner announcement
        noWinner: '😢',            // No entries
        prize: '🎁',              // Prize
        timer: '⏰',              // Timer/duration
        entries: '📊',            // Entry count
        host: '👤',               // Host
        requirements: '📋',       // Requirements
        reroll: '🔄',             // Reroll giveaway
        delete: '🗑️',            // Delete giveaway
        info: 'ℹ️',              // Giveaway info
        fixed: '🎯',             // Fixed giveaway
        claim: '⚡',              // XP Gift claim
        giftId: '🏷️',           // Gift ID
    },

    // ==================== XP SYSTEM EMOJIS ====================
    xp: {
        earn: '✨',               // XP earned
        levelUp: '🎉',            // Level up
        level: '📈',              // Level
        totalXp: '💫',           // Total XP
        currentXp: '✨',          // Current XP
        messages: '💬',           // Messages count
        progress: '📊',           // Progress bar
        nextLevel: '⬆️',         // XP to next level
        leaderboard: '🏆',        // Leaderboard
        rank1: '🥇',             // First place
        rank2: '🥈',             // Second place
        rank3: '🥉',             // Third place
        rank: '📍',              // User rank
        add: '⬆️',              // Add XP
        remove: '⬇️',           // Remove XP
        check: '📊',             // Check XP
        card: '📊',              // XP Card
    },

    // ==================== INVITE SYSTEM EMOJIS ====================
    invite: {
        total: '📊',              // Total invites
        regular: '✅',            // Regular invites
        bonus: '🎁',             // Bonus invites
        leaves: '❌',            // Leaves
        fake: '🚫',             // Fake invites
        leaderboard: '👥',       // Invite leaderboard
        check: '📨',            // Check invites
        info: '📨',             // Invite info
    },

    // ==================== ADMIN/STAFF EMOJIS ====================
    admin: {
        panel: '🛠️',            // Admin panel
        settings: '⚙️',         // Settings
        help: '❓',             // Help
        refresh: '🔄',          // Refresh
        database: '🗄️',         // Database
        restart: '🔄',          // Restart
        reset: '⚠️',           // Reset
        delete: '🗑️',          // Delete
        time: '⏰',            // Time
        log: '📝',             // Log
        status: '📊',          // Status
        server: '🌐',          // Server info
        bot: '🤖',            // Bot
        ping: '🏓',           // Ping
        uptime: '⏱️',         // Uptime
        memory: '💾',          // Memory
        cpu: '💻',            // CPU
        users: '👥',          // Users
        channels: '📺',       // Channels
        roles: '🎨',          // Roles
    },

    // ==================== STAFF COMMAND EMOJIS ====================
    staff: {
        add: '👮',               // Add staff
        remove: '👋',            // Remove staff
        timeout: '🔇',           // Timeout
        delmsg: '🗑️',           // Delete messages
        warn: '⚠️',             // Warning
        ban: '🔨',              // Ban
        kick: '👢',             // Kick
    },

    // ==================== BLACKLIST EMOJIS ====================
    blacklist: {
        add: '🚫',               // Add to blacklist
        remove: '✅',            // Remove from blacklist
        check: '📋',            // Check blacklist
        blocked: '🚫',          // Blocked
        reason: '📝',           // Reason
    },

    // ==================== STATUS EMOJIS ====================
    status: {
        online: '🟢',            // Online
        idle: '🟡',             // Idle
        dnd: '🔴',             // Do Not Disturb
        offline: '⚫',          // Offline
        enabled: '✅',          // Enabled
        disabled: '❌',         // Disabled
        active: '🟢',           // Active
        inactive: '🔴',         // Inactive
        expired: '⏰',          // Expired
        claimed: '✅',          // Claimed
    },

    // ==================== SUCCESS/ERROR EMOJIS ====================
    response: {
        success: '✅',           // Success message
        error: '❌',            // Error message
        warning: '⚠️',         // Warning message
        info: 'ℹ️',            // Info message
        loading: '⏳',          // Loading
        denied: '🚫',           // Permission denied
        invalid: '❌',          // Invalid input
        confirm: '✅',          // Confirmation
        cancel: '❌',           // Cancel
    },

    // ==================== MISC EMOJIS ====================
    misc: {
        bot: '🤖',               // Bot related
        user: '👤',              // User
        id: '🆔',              // ID
        reason: '📝',            // Reason
        date: '📅',             // Date
        channel: '📺',           // Channel
        message: '💬',           // Message
        star: '⭐',             // Star
        heart: '❤️',           // Heart
        fire: '🔥',            // Fire
        party: '🎉',           // Party
        gift: '🎁',            // Gift
        coins: '💰',           // Coins
        crown: '👑',           // Crown
        shield: '🛡️',         // Shield
        lock: '🔒',            // Lock
        unlock: '🔓',          // Unlock
        key: '🔑',            // Key
        bell: '🔔',           // Bell
        pin: '📌',           // Pin
        link: '🔗',           // Link
        search: '🔍',         // Search
        plus: '➕',            // Plus
        minus: '➖',           // Minus
        check: '✅',           // Check
        cross: '❌',           // Cross
        arrow_up: '⬆️',       // Arrow up
        arrow_down: '⬇️',     // Arrow down
        arrow_right: '➡️',    // Arrow right
    },

    // ==================== XP GIFTS EMOJIS ====================
    xpGift: {
        gift: '🎁',              // XP Gift
        claim: '⚡',             // Claim button
        claimed: '✅',           // Already claimed
        amount: '✨',            // XP amount
        restricted: '🔒',       // Restricted to user
        anyone: '🌍',           // Anyone can claim
    },

    // ==================== PROGRESS BAR ====================
    progressBar: {
        filled: '█',             // Filled character
        empty: '░',             // Empty character
    }
};
