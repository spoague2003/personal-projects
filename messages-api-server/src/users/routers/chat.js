import Router from 'express'
import User from '../models/User.js'
import Chat from '../models/Chats/Chat.js'
import MessageBucket from '../models/Chats/MessageBucket.js'
import { auth } from '../../middleware/auth.js'
import ChatInvite from '../models/requests/ChatInvite.js'
import mongoose from 'mongoose'

const router = new Router()

router.post('/chats', auth, async (req, res) => {
    try {
        let creator = req.user
        const chat = new Chat(req.body)

        chat.users.push(creator)
        await chat.save()
        res.status(201).send()
    }

    catch (err) {
        console.log(err);
        if (err.name === 'ValidationError') {
            console.log('Validation error.')
            res.status(400).send('Bad data')
        }
        else {
            res.status(500).send('Server error')
        }
    }
}
)

router.post('/chats/:chatId/invitation/:userId', auth, async (req, res) => {
    let sender = req.user
    let receiver = await User.findById(req.params.userId)

    if (sender.equals(receiver)) {
        return res.status(400).send('Cannot send chat invite to yourself.')
    }
    
    if (!receiver) {
        return res.status(404).send('User not found')
    }

    const chat = await Chat.findById(req.params.chatId)
    if (!chat) {
        return res.status(404).send('Chat not found')
    }

    if (chat.users.includes(receiver._id)) {
        return res.status(401).send('This user is already in the chat.')
    }

    const invite = new ChatInvite({
        sender: {
            username: sender.username,
            userId: sender._id
        },
        receiver: {
            username: receiver.username,
            userId: receiver._id
        },
        chat: {
            name: chat.group_name,
            chatId: chat._id
        }
    })

    receiver.requests.push(invite)

    try {
        await receiver.save()
        res.send()
    }
    catch (err) {
        console.log(err)
        res.status(500).send('Server error :(')
    }
})

router.patch('/chats/:chatId/invitation/:requestId', auth, async (req, res) => {
    const user = req.user

    const index = user.requests.findIndex(item => item._id.equals(req.params.requestId));

    if (index === -1) {
        return res.status(404).send('Request not found.')
    }

    const arr = user.requests.splice(index, 1);
    const request = arr[0]

    if (!req.query || !Object.hasOwn(req.query, 'accept')) {
        return res.status(400).send()
    }

    if (req.query.accept === 'false') {
        try {
            await user.save()
            return res.send(user.requests)
        }
        catch (err) {
            return res.status(500).send('Server error :(')
        }
    }

    if (req.query.accept === 'true') {
        try {
            const chat = await Chat.findById(req.params.chatId)
            if (!chat) {
                return res.status(404).send('Chat not found')
            }

            if (!chat.invited_users.includes(user._id)) {
                chat.users.push({ username: user.username, userId: user._id })
            }

            await chat.save()
            await user.save()
            res.status(200).send('You have been added to chat ' + chat.group_name)
        }
        catch (err) {
            return res.status(500).send('Server error :(')
        }
    }


})

router.delete('/chat/:chatId/membership', auth, async (req, res) => {
    const user = req.user
    const chat = await Chat.findById(req.params.chatId)
    if (!chat) {
        return res.status(404).send('Chat not found.')
    }

    const owner = chat.users[0]
    if(user.equals(owner)) {
        return res.status(400).send('Owner can not leave chat')
    } else {
        chat.users.pull({ username: user.username })
    }

    try {
        await chat.save()
        res.send(chat.users)
    }
    catch (err) {
        console.log(err)
        res.status(500).send('Server error :(')
    }
})

router.post('/chats/:chatId/messages', auth, async (req, res) => {
    let sender = req.user
    const chat = await Chat.findById(req.params.chatId)
    if (!chat) {
        return res.status(404).send('Chat not found.')
    }
    let content = req.body.content
    if (content.trim().length === 0 || !content) {
        return res.status(400).send('Message content cannot be empty.')
    }

    try {
        let bucket = await MessageBucket.findOne({ chat_id: chat._id }).sort({ start_date: -1 })

        const message = {
            content: content,
            timestamp: new Date(),
            sender: sender._id
        }

        if (!bucket) {
            bucket = new MessageBucket({
                chat_id: chat._id,
                start_date: new Date(),
                end_date: new Date(),
                size: 1,
                messages: []
            })
            await bucket.save()
        }

        if (bucket.size >= 25) {
            bucket.end_date = new Date()
            await bucket.save()

            bucket = new MessageBucket({
                chat_id: chat._id,
                start_date: new Date(),
                end_date: new Date(),
                size: 1,
                messages: []
            })
        }

        bucket.messages.push(message)
        bucket.size += 1
        await bucket.save()
        res.status(201).send('Message sent.')
    }
    catch (err) {
        console.log(err)
        res.status(500).send('Server error :(')
    }
})

router.get('/chats/:chatId/messages', auth, async (req, res) => {
  const chatId = req.params.chatId
  const chat = await Chat.findById(chatId)

  if (!chat) 
    return res.status(404).json({ error: 'Chat not found' })

  const search = (req.query.search || '').toString().trim()
  const escapedTerm = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const limit = req.query.limit ? Math.min(parseInt(req.query.limit, 10), 100) : 50
  const skip = req.query.offset ? parseInt(req.query.offset, 10) : 0

  try {
    const pipeline = [
      { $match: { chat_id: new mongoose.Types.ObjectId(chatId) } },
      { $unwind: '$messages' },                                    
      { $replaceRoot: { newRoot: '$messages' } },                  
      { $sort: { timestamp: -1 } },                                
      { $skip: skip },
      { $limit: limit }
    ];

    const messages = await MessageBucket.aggregate(pipeline)
    return res.status(200).send(messages)

  } catch (err) {
    return res.status(500)
  }
});

export default router;
