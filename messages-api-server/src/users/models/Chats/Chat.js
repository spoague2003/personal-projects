import mongoose, { model, Schema } from 'mongoose'

const chatSchema = new mongoose.Schema({
    chat_type: {
        enum: ["direct", "group"]
    },
    message_buckets: [{
        type: Schema.Types.ObjectId,
        ref: 'MessageBucket'
    }],
    users: [
        {
            username: String,
            user_id: {
                type: Schema.Types.ObjectId,
                ref: 'User'
            }
        }
    ],

    // group chat fields:
    group_name: String,         // optional
    owner: {                    // optional
        username: String,
        user_id: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    background: String,
    logo: Buffer,
    banned_users: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],     // optional
    invited_users: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],    // optional
    visible: Boolean            // optional
})

const Chat = mongoose.model('chats', chatSchema);

export default Chat
