import { Agent } from './RL.js';

// Define action sets for each character
const KNIGHT_ACTIONS = ['attack', 'approach', 'lunge_left', 'lunge_right', 'block', 'roll', 'idle'];
const HERO_ACTIONS = [
    'move_n', 'move_ne', 'move_e', 'move_se', 'move_s', 'move_sw', 'move_w', 'move_nw',
    'attack_melee', 'attack_melee2', 'attack_special1',
    'block', 'dodge'
];

class DemoPlayScene extends Phaser.Scene {
    constructor() {
        super('DemoPlayScene');
        this.lastAISuggestionTime = 0;
        this.aiSuggestionInterval = 3000; // 3 seconds between suggestions
    }

    init() {
        // Reset all state variables for a clean restart
        this.isDeathSequenceActive = false;
        this.gameOverActive = false;
        this._xHookInitialized = false;
        
        // Emit new game started event for backend
        this.emitNewGameEvent();
    }
    
    async emitNewGameEvent() {
        try {
            const payload = {
                event_type: 'new_game_started',
                timestamp: Date.now(),
                game_time: this.time ? this.time.now : 0,
                message: 'New demo game session started'
            };

            const response = await fetch('http://localhost:8765/game_event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('🎮 NEW DEMO GAME EVENT SENT:', data.message);
            } else {
                console.warn('Failed to send new game event - backend may not be running');
            }
        } catch (error) {
            console.warn('Could not send new game event:', error.message);
        }
    }

    // AI Suggestion System
    async requestAISuggestion() {
        try {
            window.demoInterface.setModelStatus('🤖 Analyzing...', 'loading');
            
            const gameState = this.getCurrentGameStateString();
            
            const response = await fetch('http://localhost:8765/ai_suggestion', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_state: gameState,
                    timestamp: Date.now()
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                window.demoInterface.updateAISuggestion(data.suggestion, data.confidence || 'Medium');
                window.demoInterface.setModelStatus('🤖 AI Assistant Active', 'ready');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('AI suggestion request failed:', error);
            window.demoInterface.updateAISuggestion('Unable to get AI suggestion - check if backend is running', 'Error');
            window.demoInterface.setModelStatus('❌ AI Offline', 'error');
        }
    }

    getCurrentGameStateString() {
        const heroHealthPercent = Math.round((this.hero.health / this.hero.maxHealth) * 100);
        const heroStaminaPercent = Math.round((this.hero.stamina / this.hero.maxStamina) * 100);
        const knightHealthPercent = Math.round((this.purpleKnight.health / this.purpleKnight.maxHealth) * 100);
        const knightStaminaPercent = Math.round((this.purpleKnight.stamina / this.purpleKnight.maxStamina) * 100);
        
        const distance = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, this.purpleKnight.x, this.purpleKnight.y);
        const distanceCategory = distance < 80 ? 'close' : (distance < 200 ? 'medium' : 'far');
        
        const heroAction = this.hero.anims.currentAnim?.key || 'idle';
        const knightAction = this.purpleKnight.anims.currentAnim?.key || 'idle';
        
        // Determine game phase
        let phase = 'early_game';
        if (heroHealthPercent < 30 || knightHealthPercent < 30) {
            phase = 'critical';
        } else if (heroHealthPercent < 60 || knightHealthPercent < 60) {
            phase = 'mid_game';
        }
        
        return `Hero: ${heroHealthPercent}% HP, ${heroStaminaPercent}% stamina, ${heroAction}. Knight: ${knightHealthPercent}% HP, ${knightStaminaPercent}% stamina, ${knightAction}. Distance: ${distanceCategory}, Phase: ${phase}`;
    }

    updateDemoInterface() {
        const heroHealthPercent = this.hero.health / this.hero.maxHealth;
        const heroStaminaPercent = this.hero.stamina / this.hero.maxStamina;
        const distance = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, this.purpleKnight.x, this.purpleKnight.y);
        const distanceCategory = distance < 80 ? 'Close Combat' : (distance < 200 ? 'Medium Range' : 'Long Range');
        
        let phase = 'Early Game';
        if (heroHealthPercent < 0.3 || (this.purpleKnight.health / this.purpleKnight.maxHealth) < 0.3) {
            phase = 'Critical Phase';
        } else if (heroHealthPercent < 0.6 || (this.purpleKnight.health / this.purpleKnight.maxHealth) < 0.6) {
            phase = 'Mid Game';
        }
        
        let situation = 'Positioning';
        if (this.hero.isAttacking || this.purpleKnight.isAttacking) {
            situation = 'Combat Active';
        } else if (this.hero.isBlocking || this.purpleKnight.isBlocking) {
            situation = 'Defensive Stance';
        } else if (distance < 100) {
            situation = 'Close Quarters';
        }
        
        window.demoInterface.updateGameState({
            heroHealth: heroHealthPercent,
            heroStamina: heroStaminaPercent,
            distance: distanceCategory,
            phase: phase,
            situation: situation
        });
    }

    preload() {
        // Load agent configurations
        this.load.json('heroConfig', 'heroknight.json');
        this.load.json('knightConfig', 'pknight.json');

        // Load all assets with the correct, visually confirmed 128x128 frame size.
        this.load.image('boss_arena', 'assets/map/boss_arena.png');
        this.load.spritesheet('idle', 'assets/character/Idle.png', { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('walk', 'assets/character/Walk.png', { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('run', 'assets/character/Run.png', { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('melee', 'assets/character/Melee.png', { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('rolling', 'assets/character/Rolling.png', { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('take-damage', 'assets/character/TakeDamage.png', { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('kick', 'assets/character/Kick.png', { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('melee2', 'assets/character/Melee2.png', { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('special1', 'assets/character/Special1.png', { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('die', 'assets/character/Die.png', { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('unsheath', 'assets/character/UnSheathSword.png', { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('shield-block-start', 'assets/character/ShieldBlockStart.png', { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('shield-block-mid', 'assets/character/ShieldBlockMid.png', { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('front-flip', 'assets/character/FrontFlip.png', { frameWidth: 128, frameHeight: 128 });
        this.load.image('healthbar', 'assets/character/healthbar.png');
    }

    create() {
        // --- Map ---
        const map = this.add.image(0, 0, 'boss_arena').setOrigin(0);

        // --- Input & Properties ---
        this.keys = this.input.keyboard.createCursorKeys();
        this.keys.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.keys.m = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.keys.r = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.keys.k = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K);
        this.keys.n = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.N);
        this.keys.s = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keys.q = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.keys.d = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keys.b = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
        this.keys.f = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this.keys.c = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
        this.keys.p = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P); // Screenshot key

        // Keys for the debug panel, created only once.
        this.debugKeys = this.input.keyboard.addKeys('W,A,S,D,SPACE,Q,E,R,F,B,C,V');

        this.walkSpeed = 200;
        this.runSpeed = 350;
        this.rollSpeed = 400;
        this.frontFlipSpeed = 300;
        this.facing = 's'; // Default facing direction
        this.isDeathSequenceActive = false;
        this.shieldValue = 15;

        // --- Animations ---
        // This order MUST match the sprite sheet layout and the user's explicit direction mapping.
        // Ensure that this order is unchanged at all times: ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
        const directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
        this.directionMap = new Map(directions.map((d, i) => [d, i]));
        const framesPerRow = 15;
        directions.forEach((direction, index) => {
            const startFrame = index * framesPerRow;
            
            this.anims.create({
                key: `idle-${direction}`,
                frames: this.anims.generateFrameNumbers('idle', { start: startFrame, end: startFrame + 7 }),
                frameRate: 8,
                repeat: -1
            });

            this.anims.create({
                key: `walk-${direction}`,
                frames: this.anims.generateFrameNumbers('walk', { start: startFrame, end: startFrame + 14 }),
                frameRate: 15,
                repeat: -1
            });

            this.anims.create({
                key: `run-${direction}`,
                frames: this.anims.generateFrameNumbers('run', { start: startFrame, end: startFrame + 14 }),
                frameRate: 20,
                repeat: -1
            });

            this.anims.create({
                key: `melee-${direction}`,
                frames: this.anims.generateFrameNumbers('melee', { start: startFrame, end: startFrame + 14 }),
                frameRate: 40,
                repeat: 0
            });

            this.anims.create({
                key: `rolling-${direction}`,
                frames: this.anims.generateFrameNumbers('rolling', { start: startFrame, end: startFrame + 14 }),
                frameRate: 20,
                repeat: 0
            });

            this.anims.create({
                key: `take-damage-${direction}`,
                frames: this.anims.generateFrameNumbers('take-damage', { start: startFrame, end: startFrame + 7 }),
                frameRate: 20,
                repeat: 0
            });

            this.anims.create({
                key: `kick-${direction}`,
                frames: this.anims.generateFrameNumbers('kick', { start: startFrame, end: startFrame + 14 }),
                frameRate: 40,
                repeat: 0
            });

            this.anims.create({
                key: `melee2-${direction}`,
                frames: this.anims.generateFrameNumbers('melee2', { start: startFrame, end: startFrame + 14 }),
                frameRate: 24,
                repeat: 0
            });

            this.anims.create({
                key: `special1-${direction}`,
                frames: this.anims.generateFrameNumbers('special1', { start: startFrame, end: startFrame + 14 }),
                frameRate: 30,
                repeat: 0
            });

            this.anims.create({
                key: `shield-block-start-${direction}`,
                frames: this.anims.generateFrameNumbers('shield-block-start', { start: startFrame, end: startFrame + 3 }),
                frameRate: 30,
                repeat: 0
            });

            this.anims.create({
                key: `shield-block-mid-${direction}`,
                frames: this.anims.generateFrameNumbers('shield-block-mid', { start: startFrame, end: startFrame + 5 }),
                frameRate: 10,
                repeat: -1
            });

            this.anims.create({
                key: `front-flip-${direction}`,
                frames: this.anims.generateFrameNumbers('front-flip', { start: startFrame, end: startFrame + 14 }),
                frameRate: 45,
                repeat: 0
            });
        });

        // Add a single death animation, as it's not directional
        this.anims.create({
            key: 'die',
            frames: this.anims.generateFrameNumbers('die', { start: 0, end: 14 }),
            frameRate: 8,
            repeat: 0
        });

        directions.forEach((direction, index) => {
            const startFrame = index * framesPerRow;
            const unsheathFrames = this.anims.generateFrameNumbers('unsheath', { start: startFrame, end: startFrame + 14 });
            this.anims.create({
                key: `unsheath-${direction}`,
                frames: unsheathFrames.slice().reverse(), // Play frames in reverse order
                frameRate: 15,
                repeat: 0
            });
        });

        // --- RL Agents Setup ---
        const heroConfig = this.cache.json.get('heroConfig');
        const knightConfig = this.cache.json.get('knightConfig');
        this.heroAgent = new Agent('hero', HERO_ACTIONS, heroConfig);
        this.knightAgent = new Agent('knight', KNIGHT_ACTIONS, knightConfig);

        // --- Speed up simulation ---
        this.matter.world.engine.timing.timeScale = 4;
        this.anims.globalTimeScale = 4;

        // --- Hero with Physics ---
        this.hero = this.matter.add.sprite(map.width/2, map.height/2, 'idle', 0);
        this.hero.setScale(1.5);
        this.hero.setCircle(42);
        this.hero.setFixedRotation();   // no spin
        this.hero.setIgnoreGravity(true);
        this.hero.body.slop = 0.5;   // tighter separation test
        this.hero.body.inertia = Infinity; // prevent any rotation
        this.hero.label = 'hero';
        // Hero collides with walls and knight - but immovable
        this.hero.body.collisionFilter.category = 0x0001;
        this.hero.body.collisionFilter.mask = 0x0006; // Collide with walls AND knight
        // Make hero extremely heavy and immovable to prevent being pushed
        this.hero.setMass(50000); // Increased mass
        this.hero.body.frictionStatic = 1.0; // Maximum static friction
        this.hero.body.frictionAir = 0.1; // Add air friction to stop sliding

        // Initialize attack state
        this.hero.isAttacking = false;
        this.hero.currentAttackType = null;
        this.hero.isBlocking = false;
        this.hero.isDead = false;
        
        // Initialize stamina system
        this.hero.maxStamina = 100;
        this.hero.stamina = this.hero.maxStamina;
        this.hero.staminaRegenRate = 1; // stamina per frame when not using
        this.hero.blockDisabled = false;
        this.hero.blockDisableTimer = 0;
        this.hero.staminaRegenDelay = 0;
        
        // Initialize armor attributes
        this.hero.armor = { 
            helmet: 0.10,      // 10% damage reduction for head hits
            breastplate: 0.30, // 30% damage reduction for torso hits  
            greaves: 0.15,     // 15% damage reduction for limb hits
            shieldFront: 0.50  // 50% damage reduction when blocking
        };
        
        // Initialize armor durability
        this.hero.armorDur = {
            helmet: 20,        // 20 durability points
            breastplate: 30,   // 30 durability points
            greaves: 15,       // 15 durability points
            shieldFront: 25    // 25 durability points
        };

        this.hero.on('animationcomplete', (animation) => {
            if (this.hero.isDead) { return; }
            
            // If the shield-block-start animation completes, check if the AI still wants to block.
            if (animation.key.startsWith('shield-block-start-')) {
                if (this.hero.isBlocking) { // Check the AI-controlled state flag
                    this.hero.anims.play(`shield-block-mid-${this.facing}`, true);
                } else {
                    this.hero.anims.play(`idle-${this.facing}`, true);
                }
                return;
            }

            // For all other actions, simply return to idle and wait for the next AI decision.
            if (animation.key.startsWith('melee-') || animation.key.startsWith('rolling-') || animation.key.startsWith('take-damage-') || animation.key.startsWith('kick-') || animation.key.startsWith('melee2-') || animation.key.startsWith('special1-') || animation.key.startsWith('front-flip-')) {
                this.hero.isBlocking = false; // Reset blocking state
                    this.hero.anims.play(`idle-${this.facing}`, true);
            }
        }, this);

        // --- Purple Knight ---
        this.purpleKnight = this.matter.add.sprite(map.width/2, map.height/4, 'idle', 0);
        this.purpleKnight.setScale(1.5);
        this.purpleKnight.setCircle(42);
        this.purpleKnight.setTint(0x9400D3);
        this.purpleKnight.setFixedRotation();
        this.purpleKnight.setIgnoreGravity(true);
        this.purpleKnight.body.slop = 0.5;   // tighter separation test
        this.purpleKnight.body.inertia = Infinity; // prevent any rotation
        this.purpleKnight.label = 'knight';
        // Knight collides with walls and hero - but immovable when static
        this.purpleKnight.body.collisionFilter.category = 0x0002;
        this.purpleKnight.body.collisionFilter.mask = 0x0005; // Collide with walls AND hero
        // Make knight EXTREMELY heavy and resistant to movement
        // Knight physics: Make completely immovable
        this.purpleKnight.setStatic(true); // Truly immovable static body

        this.purpleKnight.isBlocking = false;
        this.purpleKnight.shieldValue = 15;
        this.purpleKnight.facing = 's';
        this.purpleKnight.anims.play('idle-s', true); // Face down towards the player
        this.purpleKnight.maxHealth = 50;
        this.purpleKnight.health = this.purpleKnight.maxHealth;
        this.purpleKnight.attackCooldown = 0;
        this.purpleKnight.isAttacking = false;
        this.purpleKnight.currentAttackType = null;
        this.purpleKnight.isRecovering = false;
        this.purpleKnight.hitLanded = false;
        this.purpleKnight.actionCooldown = 0;
        this.purpleKnight.currentMovement = null;
        this.purpleKnight.movementDuration = 0;
        this.purpleKnight.isDead = false;
        
        // Initialize stamina for knight
        this.purpleKnight.maxStamina = 100;
        this.purpleKnight.stamina = this.purpleKnight.maxStamina;
        this.purpleKnight.staminaRegenRate = 1;
        this.purpleKnight.blockDisabled = false;
        this.purpleKnight.blockDisableTimer = 0;
        this.purpleKnight.movementDisabled = false;
        this.purpleKnight.movementDisableTimer = 0;
        this.purpleKnight.movementAngle = 0;
        this.purpleKnight.movementDirection = 's';
        this.purpleKnight.staminaRegenDelay = 0;
        
        // Aggression system - MUCH more aggressive with time scaling
        this.purpleKnight.aggressionLevel = 25; // Start with some aggression
        this.purpleKnight.timeSinceLastAttack = 0;
        this.purpleKnight.consecutiveBlocks = 0;
        this.purpleKnight.maxAggression = 100; // Base max aggression (will scale with time)
        this.purpleKnight.lastAggressionBoostTime = -1; // Track last boost time
        
        // Ominous marching system
        this.purpleKnight.ominousMarchEnabled = true;
        this.purpleKnight.marchSpeed = 1; // Slow, menacing approach
        this.purpleKnight.lastFacingUpdate = 0;
        
        // Initialize armor attributes
        this.purpleKnight.armor = { 
            helmet: 0.15,      // 15% damage reduction for head hits (heavier armor)
            breastplate: 0.40, // 40% damage reduction for torso hits (heavier armor)
            greaves: 0.20,     // 20% damage reduction for limb hits (heavier armor)
            shieldFront: 0.60  // 60% damage reduction when blocking (better shield)
        };
        
        // Initialize armor durability (heavier armor has more durability)
        this.purpleKnight.armorDur = {
            helmet: 30,        // 30 durability points
            breastplate: 40,   // 40 durability points
            greaves: 25,       // 25 durability points
            shieldFront: 35    // 35 durability points
        };

        this.purpleKnight.on('animationcomplete', (animation) => {
            if (this.purpleKnight.isDead) { return; }
            if (animation.key.startsWith('take-damage-')) {
                const direction = this.getDirectionFromAngle(Phaser.Math.Angle.Between(this.purpleKnight.x, this.purpleKnight.y, this.hero.x, this.hero.y));
                this.purpleKnight.anims.play(`idle-${direction}`, true);
            } else if (animation.key.startsWith('shield-block-start-')) {
                if (this.purpleKnight.isBlocking) {
                    const direction = this.getDirectionFromAngle(Phaser.Math.Angle.Between(this.purpleKnight.x, this.purpleKnight.y, this.hero.x, this.hero.y));
                    this.purpleKnight.anims.play(`shield-block-mid-${direction}`, true);
                } else {
                    const direction = this.getDirectionFromAngle(Phaser.Math.Angle.Between(this.purpleKnight.x, this.purpleKnight.y, this.hero.x, this.hero.y));
                    this.purpleKnight.anims.play(`idle-${direction}`, true);
                }
            }
        }, this);

        // --- Collisions ---
        const WALL = 40;                          // 40 px thickness
        const walls = [
            this.matter.add.rectangle(135+1268/2, 165-WALL/2, 1268, WALL, { 
                isStatic:true,
                collisionFilter: { category: 0x0004, mask: 0x0003 } // Walls collide with both hero and knight
            }),  // top
            this.matter.add.rectangle(105+1265/2, 818+WALL/2, 1265, WALL, { 
                isStatic:true,
                collisionFilter: { category: 0x0004, mask: 0x0003 } 
            }),  // bottom
            this.matter.add.rectangle(135-WALL/2, 165+728/2, WALL, 728, { 
                isStatic:true,
                collisionFilter: { category: 0x0004, mask: 0x0003 } 
            }),    // left
            this.matter.add.rectangle(1368+WALL/2, 165+728/2, WALL, 728, { 
                isStatic:true,
                collisionFilter: { category: 0x0004, mask: 0x0003 } 
            })   // right
        ];
        this.obstacles = walls;

        // Set up collision detection for attacks and ROBUST anti-pushing system
        this.matter.world.on('beforeupdate', () => {
            // ABSOLUTE ANTI-PUSH SYSTEM - No knight can ever push the other
            this.preventKnightPushing();
        });

        // Add collision detection specifically for knight-to-knight interactions
        this.matter.world.on('collisionstart', (event) => {
            this.handleKnightCollisions(event);
        });


        // F2 debug
        if (!this._f2) {
            this._f2 = true;
            this.input.keyboard.on('keydown-F2', () => {
                this.obstacles.forEach(o => {
                    if (!o.debugG) {
                        const bounds = o.bounds;
                        o.debugG = this.add.graphics().lineStyle(1, 0xff0000)
                            .strokeRect(bounds.min.x, bounds.min.y, bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
                    } else { 
                        o.debugG.destroy(); 
                        o.debugG = null; 
                    }
                });
            });
        }

        // --- Debug Red Boundaries (X) ---
        const redBoundaries = this.add.graphics().setDepth(100).setVisible(false);
        redBoundaries.lineStyle(2, 0xff0000, 0.8);
        const boundaryRects = [
            { x: 135, y: 165, w: 1268, h: 5 },  // top
            { x: 105, y: 818, w: 1265, h: 5 },  // bottom  
            { x: 135, y: 165, w: 5, h: 728 },   // left
            { x: 1368, y: 165, w: 5, h: 728 }   // right
        ];
        boundaryRects.forEach(r => {
            redBoundaries.strokeRect(r.x, r.y, r.w, r.h);
        });
        // Draw knight collision circle
        redBoundaries.strokeCircle(this.purpleKnight.x, this.purpleKnight.y, 42);
        // Draw hero collision circle  
        redBoundaries.strokeCircle(this.hero.x, this.hero.y, 42);


        if (!this._xHookInitialized) {
            this._xHookInitialized = true;
            this.blueBoundaries = this.add.graphics().setDepth(100).setVisible(false);
            this.greenBoundaries = this.add.graphics().setDepth(100).setVisible(false);
            this.input.keyboard.on('keydown-X', () => {
            this.debugGraphicsVisible = !this.debugGraphicsVisible;
            redBoundaries.setVisible(this.debugGraphicsVisible);
            this.blueBoundaries.setVisible(this.debugGraphicsVisible);
            this.greenBoundaries.setVisible(this.debugGraphicsVisible);
            });
            this.redBoundaries = redBoundaries; // Store for update loop
            this.boundaryRects = boundaryRects; // Store for update loop

            // --- Purple Knight Health Bar ---
            const barX = this.game.config.width / 2 - 100;
            const barY = this.game.config.height - 60; // Position adjusted for stamina bar
            const barWidth = 200;
            
            this.knightHealthBarBg = this.add.graphics().setScrollFactor(0).setDepth(101); // For glow
            this.knightHealthBar = this.add.graphics().setScrollFactor(0).setDepth(102);
            this.knightNameText = this.add.text(barX + barWidth/2, barY - 15, 'Purple Knight', {
                fontSize: '12px',
                fill: '#fff',
                fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(103);
            this.updateKnightHealthBar();

            // --- Knight Stamina Bar ---
            this.knightStaminaBarBg = this.add.graphics().setScrollFactor(0).setDepth(101); // For glow
            this.knightStaminaBar = this.add.graphics().setScrollFactor(0).setDepth(102);
            this.updateKnightStaminaBar(); // Initial draw

            // --- Game Over UI ---
            this.gameOverText = this.add.text(this.game.config.width / 2, this.game.config.height / 2 - 40, '', {
                fontSize: '48px',
                fill: '#ff0000',
                fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setVisible(false);

            this.restartText = this.add.text(this.game.config.width / 2, this.game.config.height / 2 + 20, 'Game Over', {
                fontSize: '24px',
                fill: '#ffffff'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setVisible(false);
            this.gameOverActive = false;


            // --- Health Bar ---
            this.hero.maxHealth = 100;
            this.hero.health = this.hero.maxHealth;
            this.healthBarBg = this.add.graphics().setScrollFactor(0).setDepth(101);
            this.healthBar = this.add.graphics().setScrollFactor(0).setDepth(102);
            this.updateHealthBar(); // Initial draw
            
            // Add health bar label
            this.heroNameText = this.add.text(120, 10, 'Hero Health', {
                fontSize: '12px',
                fill: '#fff',
                fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(103);
            
            // Stamina bar
            this.staminaBarBg = this.add.graphics().setScrollFactor(0).setDepth(101);
            this.staminaBar = this.add.graphics().setScrollFactor(0).setDepth(102);
            this.updateStaminaBar(); // Initial draw
        }

        // --- Event Logging Setup ---
        this.aiLog = [];
        this.hitCount = 0;
        this.totalActions = 0;
        
        this.logEvt = (actor, action) => {
            const directionStr = (actor === this.hero) ? this.facing : actor.facing;
            const event = {
                t: this.time.now,
                actor: actor.name,
                pos: [actor.x, actor.y],
                dir: this.directionMap.get(directionStr),
                hp: actor.health / actor.maxHealth,
                action
            };
            // The displayEvent function can still be used for local debug display
            this.displayEvent(event);
        };

        // --- Camera ---
        this.cameras.main.startFollow(this.hero);
        this.cameras.main.setBounds(0, 0, map.width, map.height);
        this.cameras.main.roundPixels = true;


        
        // --- Xbox Controller Setup (Native Browser API) ---
        this.gamepad = null;
        this.lastGamepadState = {};



        this.lastScreenshotTime = 0;
        this.screenshotInterval = 100; // ms
        
        // Emit new game event when scene is fully created
        this.emitNewGameEvent();
    }

    // Include all the other methods from main.js exactly as they are
    // (I'll include the key methods here but in practice, this would be all methods)
    
    getDirectionFromAngle(angle) {
        const degrees = Phaser.Math.RadToDeg(angle);
        let direction = 's';
        if (degrees >= -22.5 && degrees < 22.5) direction = 'e';
        else if (degrees >= 22.5 && degrees < 67.5) direction = 'se';
        else if (degrees >= 67.5 && degrees < 112.5) direction = 's';
        else if (degrees >= 112.5 && degrees < 157.5) direction = 'sw';
        else if (degrees >= 157.5 || degrees < -157.5) direction = 'w';
        else if (degrees >= -157.5 && degrees < -112.5) direction = 'nw';
        else if (degrees >= -112.5 && degrees < -67.5) direction = 'n';
        else if (degrees >= -67.5 && degrees < -22.5) direction = 'ne';
        return direction;
    }

    // Helper function to determine the best movement direction toward a target
    getBestMovementTowardTarget(mover, target) {
        const angle = Phaser.Math.Angle.Between(mover.x, mover.y, target.x, target.y);
        const direction = this.getDirectionFromAngle(angle);
        return `move_${direction}`;
    }

    // Helper function to check if a movement action moves toward a target
    isMovingTowardTarget(moveAction, mover, target) {
        if (!moveAction.startsWith('move_')) return false;
        
        const moveDirection = moveAction.substring(5); // Remove 'move_' prefix
        const targetDirection = this.getDirectionFromAngle(Phaser.Math.Angle.Between(mover.x, mover.y, target.x, target.y));
        
        // Check if the movement direction is the same or close to the target direction
        const directionAngles = {
            'n': -90, 'ne': -45, 'e': 0, 'se': 45,
            's': 90, 'sw': 135, 'w': 180, 'nw': -135
        };
        
        const moveAngle = directionAngles[moveDirection];
        const targetAngle = directionAngles[targetDirection];
        
        if (moveAngle === undefined || targetAngle === undefined) return false;
        
        // Calculate angle difference (handling wraparound)
        let angleDiff = Math.abs(moveAngle - targetAngle);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;
        
        // Consider it "toward" if within 67.5 degrees (1.5 directions)
        return angleDiff <= 67.5;
    }

    // ROBUST ANTI-PUSH SYSTEM - Prevents all forms of knight pushing
    preventKnightPushing() {
        if (!this.hero || !this.purpleKnight || this.hero.isDead || this.purpleKnight.isDead) return;
        
        const heroBody = this.hero.body;
        const knightBody = this.purpleKnight.body;
        
        if (!heroBody || !knightBody) return;
        
        // Store original positions for restoration if needed
        if (!this.lastValidHeroPos) {
            this.lastValidHeroPos = { x: this.hero.x, y: this.hero.y };
        }
        if (!this.lastValidKnightPos) {
            this.lastValidKnightPos = { x: this.purpleKnight.x, y: this.purpleKnight.y };
        }
        
        // Calculate current distance between knights
        const currentDistance = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, this.purpleKnight.x, this.purpleKnight.y);
        const minSeparation = 85; // Minimum allowed distance
        
        // If knights are too close, separate them immediately
        if (currentDistance < minSeparation) {
            this.separateKnights(minSeparation);
        }
        
        // ABSOLUTE velocity control - prevent any unintended movement
        // Hero movement control
        if (!heroBody.isStatic) {
            const heroVel = heroBody.velocity;
            const heroSpeed = Math.sqrt(heroVel.x * heroVel.x + heroVel.y * heroVel.y);
            
            // Only allow movement if it's AI-commanded and doesn't push the other knight
            if (heroSpeed > 0) {
                const futureHeroX = this.hero.x + heroVel.x * 0.1; // Predict 0.1 seconds ahead
                const futureHeroY = this.hero.y + heroVel.y * 0.1;
                const futureDistance = Phaser.Math.Distance.Between(futureHeroX, futureHeroY, this.purpleKnight.x, this.purpleKnight.y);
                
                // If movement would cause collision, stop it
                if (futureDistance < minSeparation || heroSpeed > 6) {
                    this.hero.setVelocity(0, 0);
                } else {
                    // Update last valid position
                    this.lastValidHeroPos = { x: this.hero.x, y: this.hero.y };
                }
            }
        }
        
        // Purple knight movement control
        if (!knightBody.isStatic) {
            const knightVel = knightBody.velocity;
            const knightSpeed = Math.sqrt(knightVel.x * knightVel.x + knightVel.y * knightVel.y);
            
            if (knightSpeed > 0) {
                const futureKnightX = this.purpleKnight.x + knightVel.x * 0.1;
                const futureKnightY = this.purpleKnight.y + knightVel.y * 0.1;
                const futureDistance = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, futureKnightX, futureKnightY);
                
                // If movement would cause collision, stop it
                if (futureDistance < minSeparation) {
                    this.purpleKnight.setVelocity(0, 0);
                    this.purpleKnight.setStatic(true);
                } else {
                    // Update last valid position
                    this.lastValidKnightPos = { x: this.purpleKnight.x, y: this.purpleKnight.y };
                }
            }
        }
    }

    // Handle direct collisions between knights
    handleKnightCollisions(event) {
        for (const pair of event.pairs) {
            const { bodyA, bodyB } = pair;
            
            // Check if this is a knight-to-knight collision
            if ((bodyA === this.hero.body && bodyB === this.purpleKnight.body) || 
                (bodyA === this.purpleKnight.body && bodyB === this.hero.body)) {
                
                // Immediately stop all movement and separate
                this.hero.setVelocity(0, 0);
                this.purpleKnight.setVelocity(0, 0);
                this.purpleKnight.setStatic(true);
                
                // Force separation
                this.separateKnights(90);
                break;
            }
        }
    }

    // Force separation between knights
    separateKnights(minDistance) {
        const currentDistance = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, this.purpleKnight.x, this.purpleKnight.y);
        
        if (currentDistance >= minDistance) return; // Already separated enough
        
        // Calculate separation vector
        const angle = Phaser.Math.Angle.Between(this.purpleKnight.x, this.purpleKnight.y, this.hero.x, this.hero.y);
        const separationNeeded = minDistance - currentDistance;
        const halfSeparation = separationNeeded / 2;
        
        // Move both knights away from each other
        const heroNewX = this.hero.x + Math.cos(angle) * halfSeparation;
        const heroNewY = this.hero.y + Math.sin(angle) * halfSeparation;
        
        const knightNewX = this.purpleKnight.x - Math.cos(angle) * halfSeparation;
        const knightNewY = this.purpleKnight.y - Math.sin(angle) * halfSeparation;
        
        // Apply positions
        this.hero.setPosition(heroNewX, heroNewY);
        this.purpleKnight.setPosition(knightNewX, knightNewY);
        
        // Ensure both are stationary
        this.hero.setVelocity(0, 0);
        this.purpleKnight.setVelocity(0, 0);
        
        // Update last valid positions
        this.lastValidHeroPos = { x: heroNewX, y: heroNewY };
        this.lastValidKnightPos = { x: knightNewX, y: knightNewY };
    }

    // Include ALL other methods from main.js here...
    // (For brevity, I'm showing just key methods, but you'd copy ALL methods)

    update(time, delta) {
        if (this.gameOverActive) {
            return; // Automatic restart is handled by showGameOverScreen
        }

        // --- DEMO: Update Interface ---
        this.updateDemoInterface();

        // --- DEMO: Auto AI Suggestions ---
        if (window.demoInterface.autoSuggestionsEnabled() && 
            time - this.lastAISuggestionTime > this.aiSuggestionInterval) {
            this.requestAISuggestion();
            this.lastAISuggestionTime = time;
        }

        // --- Data Collection ---
        if (time - (this.lastScreenshotTime || 0) > this.screenshotInterval) {
            this.takeScreenshot();
            this.lastScreenshotTime = time;
        }

        // --- Core Game Loop (same as main.js) ---
        this.updateStamina(delta);

        // ... Include all the rest of the update logic from main.js ...
        // (This would be identical to the main.js update method)
        
        // For now, just basic game state updates
        this.hero.actionCooldown = (this.hero.actionCooldown || 0) - delta;
        this.purpleKnight.actionCooldown = (this.purpleKnight.actionCooldown || 0) - delta;
        
        // Simplified AI for demo
        if (this.hero.actionCooldown <= 0 && !this.hero.isDead) {
            const heroState = this.getHeroState();
            this.hero.lastState = heroState;
            let heroAction = this.heroAgent.chooseAction(heroState);
            this.hero.lastAction = heroAction;
            this.executeHeroAction(heroAction);
            this.hero.actionCooldown = 80;
        }

        if (this.purpleKnight.actionCooldown <= 0 && !this.purpleKnight.isDead) {
            const knightState = this.getKnightState();
            this.purpleKnight.lastState = knightState;
            let knightAction = this.knightAgent.chooseAction(knightState);
            this.purpleKnight.lastAction = knightAction;
            this.executeKnightAction(knightAction);
            this.purpleKnight.actionCooldown = 50;
        }

        // Basic character tracking
        if (!this.isDeathSequenceActive) {
            this.handleIdleAndTracking(this.hero, this.purpleKnight);
        }
        
        // Ensure no visual rotation
        this.hero.setRotation(0);
        this.purpleKnight.setRotation(0);
    }

    // Include ALL other methods from main.js (getHeroState, getKnightState, executeHeroAction, etc.)
    // ... (copying all methods from main.js)

    // I'll add just the essential ones for now:
    getHeroState() {
        const knight = this.purpleKnight;
        const distance = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, knight.x, knight.y);
        
        // Discretize state variables
        const distBin = distance < 80 ? 'close' : (distance < 200 ? 'medium' : 'far');
        const knightHpBin = knight.health / knight.maxHealth > 0.6 ? 'high' : (knight.health / knight.maxHealth > 0.3 ? 'mid' : 'low');
        const heroHpBin = this.hero.health / this.hero.maxHealth > 0.6 ? 'high' : (this.hero.health / this.hero.maxHealth > 0.3 ? 'mid' : 'low');
        const knightAction = knight.isAttacking ? 'attacking' : (knight.isBlocking ? 'blocking' : 'idle');

        return { distBin, knightHpBin, heroHpBin, knightAction };
    }

    getKnightState() {
        const hero = this.hero;
        const distance = Phaser.Math.Distance.Between(this.purpleKnight.x, this.purpleKnight.y, hero.x, hero.y);

        const distBin = distance < 80 ? 'close' : (distance < 200 ? 'medium' : 'far');
        const heroAction = hero.isAttacking ? 'attacking' : (hero.isBlocking ? 'blocking' : 'idle');
        
        const aggressionBin = this.purpleKnight.aggressionLevel < 50 ? 'low' : 
                             (this.purpleKnight.aggressionLevel < 100 ? 'medium' : 
                             (this.purpleKnight.aggressionLevel < 150 ? 'high' : 'extreme'));
        
        return { distBin, heroAction, aggressionBin };
    }

    executeHeroAction(action) {
        if (this.hero.isDead || this.isActionInProgress(this.hero)) {
            return;
        }

        const movePrefix = 'move_';
        if (action.startsWith(movePrefix)) {
            const direction = action.substring(movePrefix.length);
            this.facing = direction;
            const velocity = new Phaser.Math.Vector2();
            
            if (direction.includes('n')) velocity.y = -1;
            if (direction.includes('s')) velocity.y = 1;
            if (direction.includes('w')) velocity.x = -1;
            if (direction.includes('e')) velocity.x = 1;
            
            velocity.normalize().scale(5);
            this.hero.setVelocity(velocity.x, velocity.y);
            this.hero.anims.play(`walk-${this.facing}`, true);
            return;
        }

        // Handle other actions...
        switch (action) {
            case 'block':
                if (!this.hero.blockDisabled) {
                    this.hero.isBlocking = true;
                    this.hero.anims.play(`shield-block-start-${this.facing}`, true);
                }
                break;
            case 'dodge':
                if (this.hero.stamina >= 30) {
                    this.hero.stamina -= 30;
                    this.hero.anims.play(`rolling-${this.facing}`, true);
                }
                break;
        }
    }
    
    executeKnightAction(action) {
        const knight = this.purpleKnight;
        if (knight.isDead || this.isActionInProgress(knight)) {
            return;
        }
            
        const angle = Phaser.Math.Angle.Between(knight.x, knight.y, this.hero.x, this.hero.y);
        const direction = this.getDirectionFromAngle(angle);
        knight.facing = direction;
        
        const distanceToPlayer = Phaser.Math.Distance.Between(knight.x, knight.y, this.hero.x, this.hero.y);

        if (action !== 'block') {
            knight.isBlocking = false;
        }

        switch(action) {
            case 'attack':
                if (distanceToPlayer < 100 && knight.stamina >= 15) {
                    this.performAttack(knight, 'melee');
                    knight.consecutiveBlocks = 0;
                }
                break;
            case 'approach':
                if (distanceToPlayer > 60 && knight.stamina >= 5) {
                    knight.stamina -= 5;
                    knight.currentMovement = 'approach';
                    knight.movementDuration = 500;
                }
                break;
            case 'block':
                if (!knight.blockDisabled) {
                    knight.isBlocking = true;
                    knight.consecutiveBlocks++;
                }
                break;
            case 'idle':
                knight.setVelocity(0, 0);
                const forceAction = distanceToPlayer < 100 ? 'attack' : 'approach';
                this.executeKnightAction(forceAction);
                return;
        }
    }

    isActionInProgress(character) {
        const anim = character.anims.currentAnim;
        if (!anim) return false;

        const isUninterruptibleAnim = anim.key.startsWith('melee-') ||
                                    anim.key.startsWith('rolling-') ||
                                    anim.key.startsWith('take-damage-') ||
                                    anim.key.startsWith('special1-') ||
                                    anim.key === 'die';

        return character.isAttacking || (character.anims.isPlaying && isUninterruptibleAnim);
    }

    handleIdleAndTracking(character, opponent) {
        if (character.isDead) {
            return;
        }
        
        if (this.isActionInProgress(character)) {
            return;
        }

        const angleToOpponent = Phaser.Math.Angle.Between(character.x, character.y, opponent.x, opponent.y);
        const direction = this.getDirectionFromAngle(angleToOpponent);
        
        if (character === this.hero) {
            this.facing = direction;
        } else {
            character.facing = direction;
        }

        if (character.isBlocking) {
            if (!character.anims.currentAnim || !character.anims.currentAnim.key.startsWith('shield-block-mid-')) {
                character.anims.play(`shield-block-mid-${direction}`, true);
            }
        } else {
             if (character.body.velocity.x === 0 && character.body.velocity.y === 0) {
                character.anims.play(`idle-${direction}`, true);
            }
        }
    }

    performAttack(attacker, attackType) {
        // Simplified attack for demo
        if (attacker.isAttacking || attacker.isRecovering) {
            return;
        }
        
        let staminaCost = 15;
        if (attacker.stamina < staminaCost) {
            return;
        }
        
        attacker.stamina -= staminaCost;
        attacker.isAttacking = true;
        attacker.currentAttackType = attackType;
        
        const direction = attacker === this.hero ? this.facing : attacker.facing;
        attacker.anims.play(`${attackType}-${direction}`, true);
        
        // Reset attack state when animation completes
        attacker.once('animationcomplete', (animation) => {
            if (attacker.isDead) { return; }
            if (animation.key.includes(attacker.currentAttackType)) {
                attacker.isAttacking = false;
                attacker.currentAttackType = null;
                
                if (!attacker.isRecovering) {
                    const direction = attacker === this.hero ? this.facing : attacker.facing;
                    attacker.anims.play(`idle-${direction}`, true);
                }
            }
        });
    }

    updateStamina(delta) {
        // Simplified stamina for demo
        if (this.hero.stamina < this.hero.maxStamina) {
            this.hero.stamina += this.hero.staminaRegenRate;
            this.hero.stamina = Math.min(this.hero.stamina, this.hero.maxStamina);
        }
        
        if (this.purpleKnight.stamina < this.purpleKnight.maxStamina) {
            this.purpleKnight.stamina += this.purpleKnight.staminaRegenRate;
            this.purpleKnight.stamina = Math.min(this.purpleKnight.stamina, this.purpleKnight.maxStamina);
        }
    }

    updateHealthBar() {
        // Simplified for demo
        if (!this.healthBar) return;
        
        const x = 20;
        const y = 20;
        const w = 200;
        const h = 25;
        const color = 0x00cc00;

        this.healthBar.clear();

        const healthPercentage = (this.hero.health / this.hero.maxHealth);
        const healthWidth = Math.max(0, healthPercentage * w);

        if (healthWidth > 0) {
            this.healthBar.fillStyle(color);
            this.healthBar.fillRect(x, y, healthWidth, h);
        }
    }

    updateKnightHealthBar() {
        // Simplified for demo
        if (!this.knightHealthBar) return;
        
        const x = this.game.config.width / 2 - 100;
        const y = this.game.config.height - 60;
        const w = 200;
        const h = 25;
        const color = 0x9400D3;

        this.knightHealthBar.clear();

        const healthPercentage = Math.max(0, this.purpleKnight.health / this.purpleKnight.maxHealth);
        const healthWidth = healthPercentage * w;

        if (healthWidth > 0) {
            this.knightHealthBar.fillStyle(color);
            this.knightHealthBar.fillRect(x, y, healthWidth, h);
        }
    }

    updateKnightStaminaBar() {
        // Simplified for demo
        if (!this.knightStaminaBar) return;

        const x = this.game.config.width / 2 - 100;
        const y = this.game.config.height - 30;
        const w = 200;
        const h = 10;
        const color = 0x0088ff;

        this.knightStaminaBar.clear();

        const staminaPercentage = (this.purpleKnight.stamina / this.purpleKnight.maxStamina);
        const staminaWidth = Math.max(0, staminaPercentage * w);

        if (staminaWidth > 0) {
            this.knightStaminaBar.fillStyle(color);
            this.knightStaminaBar.fillRect(x, y, staminaWidth, h);
        }
    }

    displayEvent(event) {
        const eventsContent = document.getElementById('events-content');
        if (!eventsContent) return;
        
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event-item';
        
        const formattedEvent = {
            time: Math.round(event.t),
            actor: event.actor,
            position: `[${Math.round(event.pos[0])}, ${Math.round(event.pos[1])}]`,
            direction: event.dir,
            health: `${Math.round(event.hp * 100)}%`,
            action: event.action
        };
        
        eventDiv.textContent = JSON.stringify(formattedEvent, null, 2);
        eventsContent.insertBefore(eventDiv, eventsContent.firstChild);
        
        while (eventsContent.children.length > 10) {
            eventsContent.removeChild(eventsContent.lastChild);
        }
    }

    takeScreenshot() {
        // Simplified for demo
        if (this.gameOverActive) {
            return;
        }

        const mainCanvas = this.game.canvas;
        const screenshotCanvas = document.getElementById('screenshot-canvas');

        if (!screenshotCanvas) {
            return;
        }

        screenshotCanvas.width = mainCanvas.width;
        screenshotCanvas.height = mainCanvas.height;
        const context = screenshotCanvas.getContext('2d');
        context.drawImage(mainCanvas, 0, 0, mainCanvas.width, mainCanvas.height);
        const imageData = screenshotCanvas.toDataURL('image/png');

        const heroState = {
            t: this.time.now,
            actor: this.hero.label,
            pos: [this.hero.x, this.hero.y],
            dir: this.directionMap.get(this.facing),
            hp: this.hero.health / this.hero.maxHealth,
            stamina: this.hero.stamina / this.hero.maxStamina,
            action: (this.hero.anims.currentAnim ? this.hero.anims.currentAnim.key : 'idle')
        };

        const knightState = {
            t: this.time.now,
            actor: this.purpleKnight.label,
            pos: [this.purpleKnight.x, this.purpleKnight.y],
            dir: this.directionMap.get(this.purpleKnight.facing),
            hp: this.purpleKnight.health / this.purpleKnight.maxHealth,
            stamina: this.purpleKnight.stamina / this.purpleKnight.maxStamina,
            action: (this.purpleKnight.anims.currentAnim ? this.purpleKnight.anims.currentAnim.key : 'idle')
        };

        const payload = {
            type: 'game_state_snapshot',
            image: imageData,
            hero_state: heroState,
            knight_state: knightState
        };

        fetch('http://localhost:8765/game_state_snapshot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }).catch(error => {
            console.error('Failed to send game state snapshot:', error);
        });
    }
}

const demoConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#000000',
    pixelArt: true,
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 0 },
            enableSleep: false,
            positionIterations: 6,
            velocityIterations: 6
        }
    },
    scene: [DemoPlayScene]
};

const demoGame = new Phaser.Game(demoConfig);
window.demoGame = demoGame; // Make it globally accessible
