const mongoose = require('mongoose');

const TasksSchema = new mongoose.Schema({
    titre: {
        type: String,
        required: [true, 'Le champ "titre" est requis.'],
        trim: true,
    },
    description: {
        type: String,
        required: [true, 'Le champ "description" est requis.'],
        trim: true,
    },
    état: {
        type: String,
        required: [true, 'Le champ "état" est requis.'],
        trim: true,
        validate: {
            validator: function(value) {
                return ['en cours', 'terminée', 'en attente', 'annulée'].includes(value);
            },
            message: 'La valeur du champ "état" doit être l\'une des suivantes : en cours, terminée, en attente, annulée'
        }
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('tasks', TasksSchema);
