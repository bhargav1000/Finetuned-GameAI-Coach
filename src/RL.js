// RL.js - Refactored for multiple RL agents

export class Agent {
    constructor(name, actions, config) {
        this.name = name;
        this.actions = actions;

        // RL Parameters from config
        this.qTable = {};
        this.learningRate = config.learningRate || 0.1;
        this.discountFactor = config.discountFactor || 0.9;
        this.epsilonStart = config.epsilonStart || 0.5;
        this.epsilonMin = config.epsilonMin || 0.05;
        this.epsilonDecay = (this.epsilonStart - this.epsilonMin) / (config.decaySteps || 3000);
        this.steps = 0;

        // Load any saved Q-table from localStorage
        this.loadQ();
    }

    /**
     * Creates a consistent key from a state object.
     * @param {object} state - The state object.
     * @returns {string} A unique string key for the state.
     */
    static key(state) {
        // A generic key function that can handle various state properties
        return Object.values(state).join('-');
    }

    /**
     * Chooses an action based on the current state using an epsilon-greedy strategy.
     * @param {object} state - The current state of the environment.
     * @returns {string} The chosen action.
     */
    chooseAction(state) {
        this.steps++;
        const epsilon = Math.max(this.epsilonMin, this.epsilonStart - this.epsilonDecay * this.steps);

        const stateKey = Agent.key(state);
        const qValues = this.qTable[stateKey] || this.getInitialQValues();

        // Explore with probability epsilon
        if (Math.random() < epsilon) {
            return this.actions[Math.floor(Math.random() * this.actions.length)];
        }

        // Exploit: choose the best-known action
        return Object.entries(qValues).sort((a, b) => b[1] - a[1])[0][0];
    }

    /**
     * Updates the Q-table based on the Bellman equation.
     * @param {object} prevState - The previous state.
     * @param {string} action - The action taken.
     * @param {number} reward - The reward received.
     * @param {object} nextState - The resulting new state.
     */
    updateQ(prevState, action, reward, nextState) {
        const prevKey = Agent.key(prevState);
        const nextKey = Agent.key(nextState);

        // Ensure Q-values exist for both states, initializing if necessary
        const prevQ = this.qTable[prevKey] || (this.qTable[prevKey] = this.getInitialQValues());
        const nextQ = this.qTable[nextKey] || (this.qTable[nextKey] = this.getInitialQValues());

        const maxNextQ = Math.max(...Object.values(nextQ));
        const oldQ = prevQ[action];

        // The Bellman equation
        prevQ[action] = oldQ + this.learningRate * (reward + this.discountFactor * maxNextQ - oldQ);
    }
    
    /**
     * @returns An object with all actions initialized to a Q-value of 0.
     */
    getInitialQValues() {
        const qValues = Object.fromEntries(this.actions.map(a => [a, 0]));
        
        // For knight agents, initialize idle with a very negative value to discourage it
        if (this.name === 'knight' && qValues['idle'] !== undefined) {
            qValues['idle'] = -100; // Start with heavily negative Q-value for idle
        }
        
        return qValues;
    }

    /**
     * Saves the agent's Q-table to localStorage.
     */
    saveQ() {
        try {
            localStorage.setItem(`qTable_${this.name}`, JSON.stringify(this.qTable));
            console.log(`Q-table for ${this.name} saved.`);
        } catch (e) {
            console.error(`Failed to save Q-table for ${this.name}:`, e);
        }
    }

    /**
     * Loads the agent's Q-table from localStorage.
     */
    loadQ() {
        try {
            const savedQ = localStorage.getItem(`qTable_${this.name}`);
            if (savedQ) {
                this.qTable = JSON.parse(savedQ);
                console.log(`Q-table for ${this.name} loaded.`);
            }
        } catch (e) {
            console.error(`Failed to load Q-table for ${this.name}:`, e);
        }
    }
}
