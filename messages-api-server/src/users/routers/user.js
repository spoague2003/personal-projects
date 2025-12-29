import Router from 'express'
import User from '../models/User.js'
import bcrypt from 'bcrypt'
import { auth } from '../../middleware/auth.js'

const router = new Router()

router.get('/user', async (req, res) => {
    res.status(200).send("Sam User")
})

router.post('/user', async (req, res) => {
    try {
        const user = new User(req.body)
        await user.save()

        res.status(201).send()
    }
    catch (err) {
        console.log(err)
        if (err.code === 11000) {
            console.log('Duplicate account')
            return res.status(409).send(err)
        }
        else if (err.name === 'ValidationError') {
            console.log('Validation error')
            return res.status(400).send(err)
        }
        else {
            res.status(500).send(err)
        }
    }
})

router.post('/user/login', async (req, res) => {
    try {
        let user = await User.findOne({ username: req.body.username });

        if (!user) {
            return res.status(400).send('Invalid credentials')
        }

        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            return res.status(400).send('Invalid credentials')
        }

        const authToken = await user.generateAuthToken()

        if (user.authTokens.length == 5) {
            user.authTokens.shift()
        }
        user.authTokens.push(authToken)

        await user.save()
        res.status(200).send({ user, authToken })
    }
    catch (error) {
        console.log(error)
        res.status(500).send('Internal server error')
    }
})

router.get('/user', auth, async (req, res) => {
    return res.send(req.user)
})

router.patch('/user', auth, async (req, res) => {
    const user = req.user
    const mods = req.body

    const modifiable = ['username', 'password', 'firstName', 'lastName', 'email']

    const keys = Object.keys(mods)
    const isValid = keys.every((key) => modifiable.includes(key))

    if (!isValid) {
        return res.status(400).send('One or more invalid properties.')
    }

    try {
        keys.forEach((key) => user[key] = mods[key])
        await user.save()

        res.send(user)
    }
    catch (err) {
        console.log(err)
        if (err.code === 11000) {
            console.log('Duplicate account')
            return res.status(409).send(err)
        }
        else if (err.name === 'ValidationError') {
            console.log('Validation error')
            return res.status(400).send(err)
        }
        else {
            res.status(500).send(err)
        }
    }
})

router.delete('/user', auth, async (req, res) => {
    const user = req.user

    try {
        await user.deleteOne()

        res.send()
    }
    catch (e) {
        res.status(500).send
    }
})

router.post('/user/logout', auth, async (req, res) => {
    const user = req.user
    const token = req.token

    try {
        user.authTokens = user.authTokens.filter((authToken) => authToken !== token)

        await user.save();
        res.status(200).send()
    }
    catch (err) {
        res.status(500).send;
    }
})

router.get('/users', auth, async (req, res) => {

    console.log(`GET users query: ${JSON.stringify(req.query ?? "no query")}`)

    let search = req.query?.search ?? ''
    const escapedTerm = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const filter = { username: { $regex: escapedTerm, $options: 'i' } }

    const pipeline = User.aggregate([
        { $match: filter },
        { $project: {
                "_id": 1,
                "username": 1,
                "email": 1
           } 
        }
    ])

    if (req.query.skip) {
        pipeline.append({ $skip: parseInt(req.query.skip) })
    }

    if (req.query.limit) {
        pipeline.append({ $limit: parseInt(req.query.limit) })
    }

    if (req.query.sortBy) {
        const parts = req.query.sortBy.split(':')
        const sort = {}
        sort[parts[0]] = (parts[1] === 'asc') ? 1 : -1
        pipeline.append({ $sort: sort })
    }

    try {
        const users = await pipeline.exec()
        const total = await User.countDocuments(filter)

        res.send({ users, total })
        return
    }
    catch (e) {
        console.log(e)
        res.status(500).send()
    }

})

export default router