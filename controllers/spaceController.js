const Space = require('../models/Space');

const getSpaces = async (req, res) => {
    const spaces = await Space.find({ user: req.user._id });
    res.json(spaces);
};

const createSpace = async (req, res) => {
    const { name, pricePerHour, customRates } = req.body;
    const space = new Space({
        user: req.user._id,
        name,
        pricePerHour,
        customRates
    });
    const createdSpace = await space.save();
    res.status(201).json(createdSpace);
};

const deleteSpace = async (req, res) => {
    const space = await Space.findById(req.params.id);
    if (space && space.user.toString() === req.user._id.toString()) {
        await Space.deleteOne({ _id: req.params.id });
        res.json({ message: 'Space removed' });
    } else {
        res.status(404).json({ message: 'Space not found' });
    }
};

const updateSpace = async (req, res) => {
    const { name, pricePerHour, customRates } = req.body;
    const space = await Space.findById(req.params.id);

    if (space && space.user.toString() === req.user._id.toString()) {
        space.name = name || space.name;
        // Check if explicitly passed, otherwise keep old. Can receive 0.
        if (pricePerHour !== undefined) space.pricePerHour = pricePerHour;
        if (customRates) space.customRates = customRates;

        const updatedSpace = await space.save();
        res.json(updatedSpace);
    } else {
        res.status(404).json({ message: 'Space not found' });
    }
};

module.exports = { getSpaces, createSpace, deleteSpace, updateSpace };
