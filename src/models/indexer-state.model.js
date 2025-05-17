import mongoose from 'mongoose';

const IndexerStateSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true
    },
    lastProcessedBlock: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

const IndexerState = mongoose.model('IndexerState', IndexerStateSchema);

export default IndexerState; 