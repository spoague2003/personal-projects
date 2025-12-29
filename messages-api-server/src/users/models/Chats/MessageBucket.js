import mongoose, { model, Schema } from 'mongoose'

const bucketSchema = new mongoose.Schema({
        chat_id: {
            type: Schema.Types.ObjectId,
            ref: 'Chat'
        },
        start_date: Date,
        end_date: Date,
        size: Number,
        messages: [
            {
                content: String,
                timestamp: Date,
                sender: {
                    type: Schema.Types.ObjectId,
                    ref: 'User'
                },
            },
        ]
})

const MessageBucket = new mongoose.model('buckets', bucketSchema);

export default MessageBucket;