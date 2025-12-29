import mongoose, { Schema } from 'mongoose'
import validator from 'validator'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import Request from './requests/Request.js'
import FriendRequest from './requests/FriendRequest.js'
import ChatInvite from './requests/ChatInvite.js'

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: true,
        required: [true, 'A username is required.'],
        minlength: [5, 'Username must be at least 5 characters.'],
        trim: true
    },
    firstName: {
        type: String,
        required: [true, 'A first name is required.'],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, 'A last name is required.'],
        trim: true
    },
    password: {
        type: String,
        required: [true, 'A password is required.'],
        minlength: [8, 'Password must be at least 8 characters.'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'An email address is required.'],
        trim: true,
        validate: {
            validator: (value) => validator.isEmail(value),
            message: 'Invalid email address.'
        }
    },
    authTokens: {
       type: [String],
       default: [] 
    },
    requests: [Request.schema],
    friends: [
        {
            username: {
                type: String,
                required: true
            },
            userId: {
                type: Schema.Types.ObjectId,
                required: true
            }
        }
    ]
})

userSchema.methods.toJSON = function () {
    const user = this.toObject();

    delete user.password;
    delete user.authTokens;
    delete user.__v;

    return user;
};

userSchema.methods.generateAuthToken = async function () {
    const user = this;

    const token = jwt.sign(
        {
            _id: user._id.toString(),
            type: "User"
        },
        process.env.JSON_WEB_TOKEN_SECRET
    );

    return token;
};

userSchema.pre("save", async function (next) {
    const user = this;

    if (user.isModified("password")) {
        user.password = await bcrypt.hash(user.password, 8)
    }

    next();
});

userSchema.path('requests').discriminator('FriendRequest', FriendRequest.schema);
userSchema.path('requests').discriminator('ChatInvite', ChatInvite.schema);

const User = mongoose.model('user', userSchema)

export default User

