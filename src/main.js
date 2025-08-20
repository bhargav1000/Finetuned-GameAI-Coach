import { Agent } from './RL.js';

// Define action sets for each character
const KNIGHT_ACTIONS = ['attack', 'approach', 'lunge_left', 'lunge_right', 'block', 'idle'];
const HERO_ACTIONS = [
    'move_n', 'move_ne', 'move_e', 'move_se', 'move_s', 'move_sw', 'move_w', 'move_nw',
    'attack_melee', 'attack_melee2', 'attack_special1',
    'block', 'dodge'
];

class PlayScene extends Phaser.Scene {
    constructor() {
        super('PlayScene');
    }

    init() {
        // Reset all state variables for a clean restart
        this.isDeathSequenceActive = false;
        this.gameOverActive = false;
        this._xHookInitialized = false; // Use a more specific name for the debug flag
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
        
        // Aggression system - MUCH more aggressive
        this.purpleKnight.aggressionLevel = 25; // Start with some aggression
        this.purpleKnight.timeSinceLastAttack = 0;
        this.purpleKnight.consecutiveBlocks = 0;
        this.purpleKnight.maxAggression = 200; // Allow higher aggression levels
        
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
        // Note: Event buffering and WebSocket logic has been removed.
        // Data is now sent via HTTP POST in the takeScreenshot function.
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
    }

    knightReact() {
        const knight = this.purpleKnight;
        if (knight.isDead || knight.isTakingDamage || knight.isBlocking || knight.blockDisabled) return;
    
        const distance = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, knight.x, knight.y);
    
        if (distance < 150) { 
            if (Math.random() < 0.75) { 
                knight.isBlocking = true;
                
                const angle = Phaser.Math.Angle.Between(knight.x, knight.y, this.hero.x, this.hero.y);
                const direction = this.getDirectionFromAngle(angle);
                knight.anims.play(`shield-block-start-${direction}`, true);
    
                this.time.delayedCall(600, () => {
                    knight.isBlocking = false;
                    
                    const knightAnim = knight.anims.currentAnim;
                    if(knightAnim && knightAnim.key.startsWith('shield-block-mid-')) {
                        const newAngle = Phaser.Math.Angle.Between(knight.x, knight.y, this.hero.x, this.hero.y);
                        const newDirection = this.getDirectionFromAngle(newAngle);
                        knight.anims.play(`idle-${newDirection}`, true);
                    }
                });
            }
        }
    }



    showGameOverScreen(didWin) {
        this.gameOverActive = true;
        this.isDeathSequenceActive = false;

        this.gameOverText.setText(didWin ? 'HERO WINS' : 'KNIGHT WINS').setVisible(true);
        this.restartText.setText('Restarting...').setVisible(true);
        
        // After a short delay, save both Q-tables and restart automatically  
        this.time.delayedCall(1500, () => {
            this.heroAgent.saveQ();
            this.knightAgent.saveQ();
            this.scene.restart();
        });
    }

    updateKnightHealthBar() {
        if (!this.knightHealthBar) return;
        
        const x = this.game.config.width / 2 - 100;
        const y = this.game.config.height - 60;
        const w = 200;
        const h = 25;
        const color = 0x9400D3; // Main purple
        const highlightColor = 0xC8A2C8; // Light lilac for the top highlight

        this.knightHealthBar.clear();

        const healthPercentage = Math.max(0, this.purpleKnight.health / this.purpleKnight.maxHealth);
        const healthWidth = healthPercentage * w;

        if (healthWidth > 0) {
            // Main Bar
            this.knightHealthBar.fillStyle(color);
            this.knightHealthBar.fillRect(x, y, healthWidth, h);
            // Top Highlight
            this.knightHealthBar.fillStyle(highlightColor);
            this.knightHealthBar.fillRect(x, y, healthWidth, h * 0.25); // Highlight is 25% of the height
        }
    }

    updateHealthBar() {
        if (!this.healthBar) return;
        
        const x = 20;
        const y = 20;
        const w = 200;
        const h = 25;
        const color = 0x00cc00; // A slightly darker green
        const highlightColor = 0x90EE90; // Light green

        this.healthBar.clear();

        const healthPercentage = (this.hero.health / this.hero.maxHealth);
        const healthWidth = Math.max(0, healthPercentage * w);

        if (healthWidth > 0) {
            // Main Bar
            this.healthBar.fillStyle(color);
            this.healthBar.fillRect(x, y, healthWidth, h);
            // Top Highlight
            this.healthBar.fillStyle(highlightColor);
            this.healthBar.fillRect(x, y, healthWidth, h * 0.25);
        }
    }

    updateStaminaBar() {
        const x = 20;
        const y = 50;
        const w = 200;
        const h = 10;
        const color = 0x0088ff; // Solid blue

        this.staminaBar.clear();

        const staminaPercentage = (this.hero.stamina / this.hero.maxStamina);
        const staminaWidth = Math.max(0, staminaPercentage * w);

        if (staminaWidth > 0) {
            this.staminaBar.fillStyle(color);
            this.staminaBar.fillRect(x, y, staminaWidth, h);
        }
    }

    updateKnightStaminaBar() {
        if (!this.knightStaminaBar) return;

        const x = this.game.config.width / 2 - 100;
        const y = this.game.config.height - 30;
        const w = 200;
        const h = 10;
        const color = 0x0088ff; // Solid blue

        this.knightStaminaBar.clear();

        const staminaPercentage = (this.purpleKnight.stamina / this.purpleKnight.maxStamina);
        const staminaWidth = Math.max(0, staminaPercentage * w);

        if (staminaWidth > 0) {
            this.knightStaminaBar.fillStyle(color);
            this.knightStaminaBar.fillRect(x, y, staminaWidth, h);
        }
    }

    animateHealthBarDamage(target, oldHealth) {
        // Fallback: immediately update health bar if animation system fails
        if (!this.tweens) {
    
            this.updateHealthBar();
            return;
        }
        
        // Create a temporary "damage flash" effect
        const x = 20;
        const y = 20;
        const w = 200;
        const h = 30;
        
        // Flash the health bar white briefly
        if (this.healthFlash) this.healthFlash.destroy();
        this.healthFlash = this.add.graphics().setScrollFactor(0).setDepth(103);
        this.healthFlash.fillStyle(0xffffff, 0.7);
        this.healthFlash.fillRect(x, y, w, h);
        
        // Animate the health bar dropping from old to new value
        const startHealthWidth = (oldHealth / this.hero.maxHealth) * w;
        const endHealthWidth = (target.health / this.hero.maxHealth) * w;
        
        
        this.tweens.add({
            targets: { width: startHealthWidth },
            width: endHealthWidth,
            duration: 300,
            ease: 'Power2',
            onUpdate: (tween) => {
                const currentWidth = tween.targets[0].width;
                this.healthBar.clear();
                this.healthBar.fillStyle(0x00ff00);
                this.healthBar.fillRect(x, y, Math.max(0, currentWidth), h);
            },
            onComplete: () => {
                this.updateHealthBar(); // Ensure final state is correct
            }
        });
        
        // Remove the flash effect
        this.time.delayedCall(100, () => {
            if (this.healthFlash) {
                this.healthFlash.destroy();
                this.healthFlash = null;
            }
        });
        
        // Fallback: update directly after a delay if animation fails
        this.time.delayedCall(400, () => {
            this.updateHealthBar();
        });
    }

    animateKnightHealthBarDamage(target, oldHealth) {
        // Simple smooth reduction without flashing
        if (!this.tweens) {
            this.updateKnightHealthBar();
            return;
        }
        
        const x = this.game.config.width / 2 - 100;
        const y = this.game.config.height - 60;
        const w = 200;
        const h = 25;
        
        // Animate the health bar dropping from old to new value smoothly
        const startHealthWidth = (oldHealth / this.purpleKnight.maxHealth) * w;
        const endHealthWidth = (target.health / this.purpleKnight.maxHealth) * w;
        
        // Smooth transition without flash
        this.tweens.add({
            targets: { width: startHealthWidth },
            width: endHealthWidth,
            duration: 200, // Faster, smoother transition
            ease: 'Power1', // Smoother easing
            onUpdate: (tween) => {
                const currentWidth = tween.targets[0].width;
                this.knightHealthBar.clear();
                
                const healthPercentage = Math.max(0, currentWidth / w);
                
                if (currentWidth > 0) {
                    // Main Bar
                    this.knightHealthBar.fillStyle(0x9400D3);
                    this.knightHealthBar.fillRect(x, y, currentWidth, h);
                    // Top Highlight
                    this.knightHealthBar.fillStyle(0xC8A2C8);
                    this.knightHealthBar.fillRect(x, y, currentWidth, h * 0.25);
                }
            },
            onComplete: () => {
                // Ensure final state matches the standard health bar
                this.updateKnightHealthBar();
            }
        });
    }

    getAngleFromDirection(direction) {
        const angles = {
            'e': 0, 'se': 45, 's': 90, 'sw': 135,
            'w': 180, 'nw': -135, 'n': -90, 'ne': -45
        };
        return Phaser.Math.DegToRad(angles[direction]);
    }

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

    performAttack = (attacker, attackType) => {
        // Prevent attacks during recovery or existing attack
        if (attacker.isAttacking || attacker.isRecovering) {
            return;
        }
        
        // Check stamina cost
        let staminaCost = 10; // Default
        if (attackType === 'melee') staminaCost = 15;
        else if (attackType === 'melee2') staminaCost = 25;
        else if (attackType === 'special1') staminaCost = 40;
        else if (attackType === 'kick') staminaCost = 20;
        
        // Check if enough stamina
        if (attacker.stamina < staminaCost) {
            return;
        }
        
        // Consume stamina
        attacker.stamina -= staminaCost;
        
        // Set stamina regen delay based on attack
        if (attackType === 'special1') {
            attacker.staminaRegenDelay = 1500; // 1.5s delay
        } else if (attackType === 'melee2') {
            attacker.staminaRegenDelay = 1000; // 1s delay
        } else {
            attacker.staminaRegenDelay = 500; // 0.5s delay for light attacks
        }
        
        attacker.isAttacking = true;
        attacker.currentAttackType = attackType;
        
        // Get direction for the attacker
        const direction = attacker === this.hero ? this.facing : attacker.facing;
        
        // Play attack animation and immediately pause on frame 0 for wind-up
        attacker.anims.play(`${attackType}-${direction}`, true);
        attacker.anims.pause(); // Freeze on first frame
        
        // Log the attack event
        this.logEvt(attacker, `attack_${attackType}`);
        
        // Delay before blade glow flash (50ms before impact)
        this.time.delayedCall(50, () => this.triggerBladeGlow(attacker), [], this);
        
        // Delay before continuing animation and spawning hit sensor (100ms wind-up)
        this.time.delayedCall(100, () => this.continueAttack(attacker), [], this);
    };

    triggerBladeGlow = (attacker) => {
        if (!attacker.isAttacking) return; // Attack was cancelled
        
        // Apply bright yellow/white tint for blade glow effect
        attacker.setTint(0xFFFF99); // Bright yellow-white color
        
        // Remove tint after 50ms
        this.time.delayedCall(50, () => {
            if (attacker.active) {
                // Restore original tint
                if (attacker === this.purpleKnight) {
                    attacker.setTint(0x9400D3); // Purple knight's original color
                } else {
                    attacker.clearTint(); // Hero's original color
                }
            }
        });
    };

    continueAttack = (attacker) => {
        if (!attacker.isAttacking) return; // Attack was cancelled
        
        // Resume the paused animation to continue from frame 1
        attacker.anims.resume();
        
        // Spawn sword sensor exactly when the blade should be “live”
        const target = attacker === this.hero ? this.purpleKnight : this.hero;
        this.spawnSwordSensor(attacker, target, attacker.currentAttackType);

        
        // Emit sword arc particles at the moment of sensor spawn
        this.createSwordArcParticles(attacker);
        
        // Nudge camera opposite to swing direction for impact effect
        this.nudgeCamera(attacker);
        

        
        // Reset attack state when animation completes
        attacker.once('animationcomplete', (animation) => {
            if (attacker.isDead) { return; }
            // Only handle attack animations
            if (animation.key.includes(attacker.currentAttackType)) {
                attacker.isAttacking = false;
                attacker.currentAttackType = null;
                attacker.attackCooldown = 0;
                
                // Return to idle if not recovering
                if (!attacker.isRecovering) {
                    const direction = attacker === this.hero ? this.facing : attacker.facing;
                    attacker.anims.play(`idle-${direction}`, true);
                }
            }
        });
    };

    createSwordArcParticles = (attacker) => {
        const direction = attacker === this.hero ? this.facing : attacker.facing;
        const angle = this.getAngleFromDirection(direction);
        
        // Create 3-5 spark particles along the blade arc
        const numParticles = Phaser.Math.Between(3, 5);
        
        for (let i = 0; i < numParticles; i++) {
            // Position particles along an arc in front of the attacker
            const arcProgress = i / (numParticles - 1); // 0 to 1
            const arcRadius = 20 + (arcProgress * 15); // 20 to 35 pixels from attacker
            const arcAngle = angle + (arcProgress - 0.5) * 0.8; // Small arc spread
            
            const particleX = attacker.x + Math.cos(arcAngle) * arcRadius;
            const particleY = attacker.y + Math.sin(arcAngle) * arcRadius;
            
            // Create spark particle using graphics
            const spark = this.add.graphics();
            spark.fillStyle(0xFFFFAA); // Bright yellow spark
            spark.fillCircle(0, 0, 2); // Small 2px radius spark
            spark.setPosition(particleX, particleY);
            spark.setDepth(50); // Above characters but below UI
            
            // Add particle movement and fade out
            const velocityX = Math.cos(arcAngle) * 30 + (Math.random() - 0.5) * 20;
            const velocityY = Math.sin(arcAngle) * 30 + (Math.random() - 0.5) * 20;
            
            // Animate particle
            this.tweens.add({
                targets: spark,
                x: particleX + velocityX,
                y: particleY + velocityY,
                alpha: 0,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: 200,
                ease: 'Power2',
                onComplete: () => {
                    spark.destroy();
                }
            });
        }
    };

    spawnSwordSensor(attacker, target, attackType) {
        // 1. Get the angle from the attacker’s current facing direction.
        const direction = attacker === this.hero ? this.facing : attacker.facing;
        const angle = this.getAngleFromDirection(direction);

        // 2. The sensor is pushed out by a fixed distance (the sword's reach).
        const reach = 60; // A fixed distance of 60 pixels.

        const offset = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle))
                       .scale(reach);

        // ------------------------------------------------------------------
        // 3) Big enough rectangle so slight aim errors still count
        // ------------------------------------------------------------------
        const sensorBody = this.matter.add.rectangle(
            attacker.x + offset.x,
            attacker.y + offset.y,
            40, 40,                               // larger “blade” area
            { isSensor: true, label: 'sword' }
        );

        // Use the attacker's own collision category for the sensor. This makes the sensor
        // act as a proxy for the attacker, ensuring it collides with the target correctly.
        sensorBody.collisionFilter = {
            category: attacker.body.collisionFilter.category,
            mask: 0xFFFF // Check against all other categories
        };

        // Debug visualization removed - no more yellow boxes

        // ------------------------------------------------------------------
        // Single-use collision handler
        // ------------------------------------------------------------------
        const onHit = (event) => {
            for (const { bodyA, bodyB } of event.pairs) {
                const hit = (bodyA === sensorBody && bodyB === target.body) ||
                            (bodyB === sensorBody && bodyA === target.body);

                if (hit) {
                    this.handleAttackImpact(attacker, target, attackType);
                    this.matter.world.off('collisionstart', onHit);
                    this.matter.world.remove(sensorBody);
                    return;
                }
            }
        };
        this.matter.world.on('collisionstart', onHit);

        // Safety cleanup after 200 ms (≈ attack animation length)
        this.time.delayedCall(200, () => {
            this.matter.world.off('collisionstart', onHit);
            this.matter.world.remove(sensorBody);
        });
    }

    handleAttackImpact(attacker, target, attackType) {
        if (!target || target.isDead || target.isTakingDamage) {
            return;
        }

        // --- NEW DIRECTIONAL BLOCKING LOGIC ---
        if (target.isBlocking && !target.blockDisabled) {
            // Angle from the defender (target) to the attacker. This is the direction of the incoming threat.
            const angleToAttacker = Phaser.Math.Angle.Between(target.x, target.y, attacker.x, attacker.y);

            // The direction the defender is currently facing, which is stored differently for hero and knight.
            const targetFacingDirection = (target === this.hero) ? this.facing : target.facing;
            const targetFacingAngle = this.getAngleFromDirection(targetFacingDirection);

            // Calculate the shortest angle difference. This correctly handles wrap-around (e.g., -170 vs 170 degrees).
            const angleDifference = Phaser.Math.Angle.ShortestBetween(Phaser.Math.RadToDeg(targetFacingAngle), Phaser.Math.RadToDeg(angleToAttacker));

            // Successful block if the defender is facing the attacker within a 90-degree arc (±45 degrees).
            if (Math.abs(angleDifference) <= 45) {
                // 1. Consume stamina for the block.
                const staminaCost = 15; // Stamina cost for a successful block.
                target.stamina = Math.max(0, target.stamina - staminaCost);

                // 2. Stop all further processing. No damage, no knockback.
                return;
            }
            // If the block is not successful (wrong direction), the attack proceeds below.
        }
        // --- END NEW BLOCKING LOGIC ---

        // Base damage values
        let baseDamage = 10;
        if (attackType === 'melee2') baseDamage = 15;
        if (attackType === 'special1') baseDamage = 25;
        if (attackType === 'kick') baseDamage = 5;

        const wasKnight = (attacker === this.purpleKnight && target === this.hero);

        // Calculate all modifiers (blocking is now handled above)
        const armorMod = this.getArmorModifier(target, attacker.x, attacker.y, baseDamage);
        const critMod = this.getCritModifier(attacker, target);
        let finalDamage = baseDamage * armorMod * critMod;

        // Apply the final calculated damage
        this.applyDamage(target, finalDamage);

        // Play hit reaction and apply knockback
        if (finalDamage > 0 && !target.isDead) {
            this.playHitReaction(target);
            this.applyKnockback(target, attacker, 0.5);
        }
    }

    nudgeCamera = (attacker) => {
        const direction = attacker === this.hero ? this.facing : attacker.facing;
        const angle = this.getAngleFromDirection(direction);
        
        // Calculate nudge direction (opposite to swing direction)
        const nudgeAngle = angle + Math.PI; // 180 degrees opposite
        const nudgeStrength = Phaser.Math.Between(2, 3); // 2-3 pixel nudge
        
        // Calculate nudge offset
        const nudgeX = Math.cos(nudgeAngle) * nudgeStrength;
        const nudgeY = Math.sin(nudgeAngle) * nudgeStrength;
        
        // Store original camera position
        const originalX = this.cameras.main.scrollX;
        const originalY = this.cameras.main.scrollY;
        
        // Apply camera nudge
        this.cameras.main.setScroll(originalX + nudgeX, originalY + nudgeY);
        
        // Return camera to original position after one frame (~16ms)
        this.time.delayedCall(16, () => {
            this.cameras.main.setScroll(originalX, originalY);
        });
    };





    

    handleDeath(character) {
        // This is the definitive death handler. No other logic should interfere once this is called.
        if (character.isDead) {
            return;
        }
        
        console.log(`Death triggered for ${character.label}`); // Debug log
        character.isDead = true;
        this.isDeathSequenceActive = true;

        // Stop all movement and physics.
        character.setVelocity(0, 0);
        character.setStatic(true); // Make the body immovable.

        // CRITICAL FIX: Stop all current animations and remove any pending animation listeners
        // that could interrupt the death sequence.
        character.anims.stop();
        character.off('animationcomplete');

        const victor = (character === this.hero) ? this.purpleKnight : this.hero;
        const loser = character;
        const didWin = (victor === this.hero);

        // Determine the correct facing direction for the victor's animation.
        const victorFacing = (victor === this.hero) ? this.facing : victor.facing;

        // Play the final animations.
        victor.anims.play(`unsheath-${victorFacing}`, true);
        loser.anims.play('die', true);

        // When the death animation completes, end the game.
        // Add a backup timer in case animation doesn't complete
        loser.once('animationcomplete', (animation) => {
            if (animation.key === 'die') {
                console.log('Death animation completed, showing game over');
                this.showGameOverScreen(didWin);
            }
        });
        
        // Backup: Force game over after 2 seconds if animation doesn't trigger
        this.time.delayedCall(2000, () => {
            if (this.isDeathSequenceActive && !this.gameOverActive) {
                console.log('Backup game over trigger');
                this.showGameOverScreen(didWin);
            }
        });
    }



    getArmorModifier = (target, hitX, hitY, damage) => {
        // Determine armor slot based on blocking status and hit zone
        let armorSlot = 'breastplate'; // default to torso
        
        if (hitX !== undefined && hitY !== undefined) {
            // Calculate hit zone based on distance from target center
            const targetRadius = target.body.circleRadius;
            const d = Phaser.Math.Distance.Between(hitX, hitY, target.x, target.y);
            
            if (d < targetRadius * 0.3) {
                // Head zone
                armorSlot = 'helmet';
            } else if (d < targetRadius * 0.7) {
                // Torso zone  
                armorSlot = 'breastplate';
            } else {
                // Limbs zone
                armorSlot = 'greaves';
            }
        }
        
        // Apply armor durability damage
        if (target.armorDur && target.armorDur[armorSlot] > 0) {
            target.armorDur[armorSlot] -= damage;
            if (target.armorDur[armorSlot] <= 0) {
                target.armor[armorSlot] /= 2;  // Halve protection when broken
                target.armorDur[armorSlot] = 0; // Mark as broken
            }
        }
        
        // Apply armor damage reduction: dmg *= (1 - armor[slot])
        const armorReduction = target.armor[armorSlot] || 0;
        return (1 - armorReduction);
    };

    getCritModifier = (attacker, target) => {
        // Basic crit system - can be expanded later
        const critChance = 0.1; // 10% crit chance
        if (Math.random() < critChance) {
            return 1.5; // 50% more damage on crit
        }
        return 1.0; // No crit
    };

    applyDamage = (target, damage) => {
        if (!target || target.isDead) return;

        const oldHealth = target.health;
        target.health = Math.max(0, target.health - damage);
        
        console.log(`${target.label} took ${damage} damage. Health: ${oldHealth} -> ${target.health}`);
        
        // --- REWARD/PENALTY LOGIC ---
        const attacker = (target === this.hero) ? this.purpleKnight : this.hero;
        const attackerAgent = (attacker === this.hero) ? this.heroAgent : this.knightAgent;
        const targetAgent = (target === this.hero) ? this.heroAgent : this.knightAgent;
        
        // Define reward/penalty values - MAKE AGGRESSION HIGHLY REWARDED
        // Scale rewards based on purple knight's aggression level
        const aggressionMultiplier = attacker === this.purpleKnight ? (1 + this.purpleKnight.aggressionLevel / 50) : 1; // More aggressive scaling
        const HIT_REWARD = 75 * aggressionMultiplier; // Higher base reward + escalating
        const DAMAGE_PENALTY = -25; // Keep penalty moderate
        const WIN_REWARD = 200; // Winning is very important
        const LOSS_PENALTY = -200; // Losing is very bad

        // Get current states for updating Q-table
        const attackerPrevState = (attacker === this.hero) ? this.heroAgent.lastState : this.knightAgent.lastState;
        const targetPrevState = (target === this.hero) ? this.heroAgent.lastState : this.knightAgent.lastState;
        
        // Store last action taken by each agent, if not already stored
        if (!attacker.lastAction) attacker.lastAction = attackerAgent.actions[0];
        if (!target.lastAction) target.lastAction = targetAgent.actions[0];
        
        // Reward attacker, penalize target
        if (damage > 0) {
            if (attackerPrevState) {
                attackerAgent.updateQ(attackerPrevState, attacker.lastAction, HIT_REWARD, this.getAgentState(attacker, true));
                
                // Reset aggression timer for purple knight when attacking successfully
                if (attacker === this.purpleKnight) {
                    this.purpleKnight.timeSinceLastAttack = 0;
                    this.purpleKnight.consecutiveBlocks = 0;
                }
            }
            if (targetPrevState) {
                targetAgent.updateQ(targetPrevState, target.lastAction, DAMAGE_PENALTY, this.getAgentState(target, true));
            }
        }

        this.logEvt(target, `took_damage_${damage.toFixed(1)}`);
        
        if (target === this.hero) {
            this.animateHealthBarDamage(target, oldHealth);
        } else if (target === this.purpleKnight) {
            this.animateKnightHealthBarDamage(target, oldHealth);
        }

        // Check for death condition - any knight reaching 0 health
        if (target.health <= 0 && !target.isDead) {
            // Penalize the loser, reward the winner
            if (targetPrevState) {
                targetAgent.updateQ(targetPrevState, target.lastAction, LOSS_PENALTY, { state: 'dead' });
            }
            if (attackerPrevState) {
                attackerAgent.updateQ(attackerPrevState, attacker.lastAction, WIN_REWARD, this.getAgentState(attacker, true));
            }
            this.handleDeath(target);
        } else if (!target.isDead) {
            target.isTakingDamage = true;
            this.time.delayedCall(500, () => { 
                if (target && target.active) {
                    target.isTakingDamage = false; 
                }
            });
        }
    };
    
    // Helper to get state for the correct agent
    getAgentState(character, isNext = false) {
        // For the next state, we always calculate fresh
        if (isNext) {
            return (character === this.hero) ? this.getHeroState() : this.getKnightState();
        }
        // For the previous state, we retrieve what we stored
        return (character === this.hero) ? this.hero.lastState : this.purpleKnight.lastState;
    }

    applyKnockback = (target, attacker, attackType) => {
        // Special knockback for special attack on knight
        if (attackType === 'special1' && target === this.purpleKnight) {
            const knockbackAngle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);
            const knockbackVelocity = new Phaser.Math.Vector2(Math.cos(knockbackAngle), Math.sin(knockbackAngle)).scale(5); // Increased force for visibility
            
            target.setStatic(false);
            target.setVelocity(knockbackVelocity.x, knockbackVelocity.y);
            
            this.time.delayedCall(150, () => {
                if (target.active && !target.isDead) {
                    target.setVelocity(0, 0);
                    target.setStatic(true);
                }
            });
            return;
        }

        // Original knockback logic for the hero
        if (target === this.hero) {
            const knockbackDistance = 15;
            const knockbackAngle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);
            const knockbackVelocity = new Phaser.Math.Vector2(Math.cos(knockbackAngle), Math.sin(knockbackAngle)).scale(knockbackDistance * 0.5);
            target.setVelocity(knockbackVelocity.x, knockbackVelocity.y);
            this.time.delayedCall(50, () => {
                if (target.active && !target.isDead) {
                    target.setVelocity(0, 0);
                }
            });
        }
    };

    playHitReaction = (target) => {

        if (!target.active) return; // Prevent errors if target is destroyed

        // If the target was attacking, cancel it to prevent a stun lock.
        if (target.isAttacking) {
            target.isAttacking = false;
            target.currentAttackType = null;
        }

        // Visual feedback
        target.setTint(0xff0000);
        
        // Play damage animation
        const attacker = target === this.hero ? this.purpleKnight : this.hero;
        let angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);

        // To play the animation for the direction OPPOSITE to the hit, we add PI (180 degrees)
        // to the impact angle. This makes the character appear to recoil from the blow.
        angle = Phaser.Math.Angle.Wrap(angle + Math.PI);

        const direction = this.getDirectionFromAngle(angle);
        target.anims.play(`take-damage-${direction}`, true);
        
        // Reset tint after duration
        this.time.delayedCall(200, () => {
            if (target.active) { // Check if target is still active
                if (target === this.purpleKnight) {
                    target.setTint(0x9400D3);
                } else {
                    target.clearTint();
                }
            }
        });
    };

    // =================================================================
    //  STATE AND ACTION FUNCTIONS FOR RL AGENTS
    // =================================================================

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
        
        // Add aggression level to state to influence decision making - more sensitive thresholds
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
            
            velocity.normalize().scale(5); // Increased from 3
            this.hero.setVelocity(velocity.x, velocity.y);
            this.hero.anims.play(`walk-${this.facing}`, true);
            return;
        }

        const attackPrefix = 'attack_';
        if (action.startsWith(attackPrefix)) {
            const attackType = action.substring(attackPrefix.length);
            this.performAttack(this.hero, attackType);
            return;
        }
        
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
            
        // ALWAYS face the hero before executing any action for better responsiveness
        const angle = Phaser.Math.Angle.Between(knight.x, knight.y, this.hero.x, this.hero.y);
        const direction = this.getDirectionFromAngle(angle);
        knight.facing = direction;
        
        // Disable ominous marching temporarily during specific actions
        if (action === 'attack' || action === 'block' || action.startsWith('lunge')) {
            knight.ominousMarchEnabled = false;
            this.time.delayedCall(300, () => {
                if (knight.active) knight.ominousMarchEnabled = true;
            });
        }
        
        const distanceToPlayer = Phaser.Math.Distance.Between(knight.x, knight.y, this.hero.x, this.hero.y);

        // --- State Management ---
        // Cancel block for any non-blocking action
        if (action !== 'block') {
            knight.isBlocking = false;
        }

        switch(action) {
            case 'attack':
                if (distanceToPlayer < 100 && knight.stamina >= 15) {
                    this.performAttack(knight, 'melee');
                    // Reset consecutive blocks when attacking
                    knight.consecutiveBlocks = 0;
                }
                break;
            case 'approach':
                if (distanceToPlayer > 60 && knight.stamina >= 5) {
                    knight.stamina -= 5;
                    knight.currentMovement = 'approach';
                    knight.movementDuration = 500;
                    // No need to set angle/direction here, as tracking handles it
                }
                break;
            case 'lunge_left':
                 if (knight.stamina >= 20) {
                    knight.stamina -= 20;
                    knight.currentMovement = 'lunge_left';
                    knight.movementDuration = 300;
                    knight.movementAngle = angle - Math.PI / 2;
                    knight.movementDirection = direction;
                }
                break;
            case 'lunge_right':
                if (knight.stamina >= 20) {
                    knight.stamina -= 20;
                    knight.currentMovement = 'lunge_right';
                    knight.movementDuration = 300;
                    knight.movementAngle = angle + Math.PI / 2;
                    knight.movementDirection = direction;
                }
                break;
            case 'block':
                if (!knight.blockDisabled) {
                    knight.isBlocking = true;
                    // Track consecutive blocks for aggression penalty
                    knight.consecutiveBlocks++;
                    // The actual animation will be handled by the tracking logic in update()
                }
                break;
            case 'idle':
                // NEVER ALLOW IDLE - always force an aggressive action
                knight.setVelocity(0, 0);
                
                // Immediately choose a more aggressive action instead
                const distanceToHero = Phaser.Math.Distance.Between(knight.x, knight.y, this.hero.x, this.hero.y);
                let forceAction;
                
                if (distanceToHero < 100) {
                    forceAction = 'attack';
                } else if (distanceToHero < 200) {
                    forceAction = Math.random() < 0.5 ? 'lunge_left' : 'lunge_right';
                } else {
                    forceAction = 'approach';
                }
                
                // Execute the forced action immediately
                this.executeKnightAction(forceAction);
                return;
        }
    }

    isActionInProgress(character) {
        const anim = character.anims.currentAnim;
        if (!anim) return false;

        // Defines actions that are uninterruptible. Note that blocking is NOT here.
        const isUninterruptibleAnim = anim.key.startsWith('melee-') ||
                                    anim.key.startsWith('rolling-') ||
                                    anim.key.startsWith('take-damage-') ||
                                    anim.key.startsWith('special1-') ||
                                    anim.key === 'die';

        return character.isAttacking || (character.anims.isPlaying && isUninterruptibleAnim);
    }

    handleIdleAndTracking(character, opponent) {
        // This is a hard stop. If a character is dead, no tracking or idle logic should run.
        if (character.isDead) {
            return;
        }
        
        if (this.isActionInProgress(character)) {
            return;
        }

        const angleToOpponent = Phaser.Math.Angle.Between(character.x, character.y, opponent.x, opponent.y);
        const direction = this.getDirectionFromAngle(angleToOpponent);
        
        // For the hero, the facing property is top-level; for the knight, it's on the object itself.
        if (character === this.hero) {
            this.facing = direction;
        } else {
            character.facing = direction;
            
            // OMINOUS MARCHING: Purple knight always faces and slowly approaches hero
            if (character === this.purpleKnight && character.ominousMarchEnabled) {
                this.executeOminousMarch(character, opponent);
                return; // Skip normal idle logic
            }
        }

        if (character.isBlocking) {
            // If the block animation isn't already playing, start it.
            if (!character.anims.currentAnim || !character.anims.currentAnim.key.startsWith('shield-block-mid-')) {
                character.anims.play(`shield-block-mid-${direction}`, true);
            }
        } else {
            // If not blocking and not moving via AI, play the idle animation.
             if (character.body.velocity.x === 0 && character.body.velocity.y === 0) {
                character.anims.play(`idle-${direction}`, true);
            }
        }
    }

    executeOminousMarch(knight, hero) {
        // Calculate distance and angle to hero
        const distance = Phaser.Math.Distance.Between(knight.x, knight.y, hero.x, hero.y);
        const angleToHero = Phaser.Math.Angle.Between(knight.x, knight.y, hero.x, hero.y);
        const direction = this.getDirectionFromAngle(angleToHero);
        
        // ALWAYS face the hero - this is critical for menacing effect
        knight.facing = direction;
        
        // Only march if not too close (maintain menacing distance but always approach)
        if (distance > 70) {
            // Slow, ominous approach - like a horror movie villain
            const marchSpeed = knight.marchSpeed * (1 + knight.aggressionLevel / 200); // Slightly faster with aggression
            const moveVector = new Phaser.Math.Vector2(Math.cos(angleToHero), Math.sin(angleToHero)).scale(marchSpeed);
            
            // Set as non-static temporarily for movement
            knight.setStatic(false);
            knight.setVelocity(moveVector.x, moveVector.y);
            knight.intentionalMovement = true; // Mark as intentional movement
            
            // Play slow walk animation for ominous effect
            const walkAnimKey = `walk-${direction}`;
            if (knight.anims.currentAnim?.key !== walkAnimKey) {
                knight.anims.play(walkAnimKey, true);
                // Use consistent animation speed - don't override msPerFrame
            }
        } else {
            // Stop when close, but keep staring menacingly
            knight.setVelocity(0, 0);
            knight.setStatic(true);
            knight.intentionalMovement = false; // Clear intentional movement flag
            
            // Menacing idle stare
            const idleAnimKey = `idle-${direction}`;
            if (knight.anims.currentAnim?.key !== idleAnimKey) {
                knight.anims.play(idleAnimKey, true);
                // Use consistent animation speed - don't override msPerFrame
            }
        }
    }

    update(time, delta) {
        if (this.gameOverActive) {
            return; // Automatic restart is handled by showGameOverScreen
        }

        // --- Data Collection ---
        if (time - (this.lastScreenshotTime || 0) > this.screenshotInterval) {
            this.takeScreenshot();
            this.lastScreenshotTime = time;
        }

        // --- Core Game Loop ---
        this.updateStamina(delta);

        // --- AI Decision Making ---
        this.hero.actionCooldown = (this.hero.actionCooldown || 0) - delta;
        this.purpleKnight.actionCooldown = (this.purpleKnight.actionCooldown || 0) - delta;
        
        // Hero AI Tick
        if (this.hero.actionCooldown <= 0 && !this.hero.isDead) {
            const heroState = this.getHeroState();
            
            // --- HERO DISTANCE CLOSING PRIORITY SYSTEM ---
            // Penalize hero for being far from knight and not moving closer
            if (this.hero.lastState && heroState.distBin === 'far') {
                // Check if hero took a distance-closing action
                const isMovingTowardKnight = this.hero.lastAction?.startsWith('move_') && this.isMovingTowardTarget(this.hero.lastAction, this.hero, this.purpleKnight);
                if (!isMovingTowardKnight && !this.hero.lastAction?.startsWith('attack_')) {
                    this.heroAgent.updateQ(this.hero.lastState, this.hero.lastAction, -25, heroState); // Penalty for not closing distance when far
                }
                // Additional distance penalty
                this.heroAgent.updateQ(this.hero.lastState, this.hero.lastAction, -8, heroState);
            }
            
            // Medium distance should prioritize getting closer or attacking
            if (this.hero.lastState && heroState.distBin === 'medium') {
                const isAggressiveAction = this.hero.lastAction?.startsWith('attack_') || (this.hero.lastAction?.startsWith('move_') && this.isMovingTowardTarget(this.hero.lastAction, this.hero, this.purpleKnight));
                if (!isAggressiveAction) {
                    this.heroAgent.updateQ(this.hero.lastState, this.hero.lastAction, -12, heroState); // Penalty for passive actions at medium range
                }
            }
            
            this.hero.lastState = heroState; // Store state
            let heroAction = this.heroAgent.chooseAction(heroState);
            
            // ENHANCE HERO ACTION SELECTION - Bias toward distance closing
            if (heroState.distBin === 'far' && Math.random() < 0.6) { // 60% chance to override with movement toward knight
                heroAction = this.getBestMovementTowardTarget(this.hero, this.purpleKnight);
            } else if (heroState.distBin === 'medium' && Math.random() < 0.4) { // 40% chance to move closer or attack
                if (Math.random() < 0.7) {
                    heroAction = this.getBestMovementTowardTarget(this.hero, this.purpleKnight);
                } else {
                    heroAction = Math.random() < 0.5 ? 'attack_melee' : 'attack_melee2';
                }
            }
            
            // REWARD SYSTEM for hero distance-closing actions
            if (heroAction.startsWith('move_') && this.isMovingTowardTarget(heroAction, this.hero, this.purpleKnight)) {
                let reward = 12; // Base reward for moving toward knight
                if (heroState.distBin === 'far') reward += 15; // Extra reward when far
                else if (heroState.distBin === 'medium') reward += 10; // Good reward when medium
                this.heroAgent.updateQ(heroState, heroAction, reward, heroState);
            } else if (heroAction.startsWith('attack_') && heroState.distBin === 'close') {
                this.heroAgent.updateQ(heroState, heroAction, 18, heroState); // Big reward for attacking when close
            }
            
            this.hero.lastAction = heroAction; // Store action
            this.executeHeroAction(heroAction);
            this.hero.actionCooldown = 80; // Slightly faster for more aggressive behavior
        }

        // Knight AI Tick - More responsive for combat
        if (this.purpleKnight.actionCooldown <= 0 && !this.purpleKnight.isDead) {
            const knightState = this.getKnightState();

            // --- Aggression System Updates ---
            this.purpleKnight.timeSinceLastAttack += delta;
            
            // MUCH faster aggression buildup
            if (this.purpleKnight.timeSinceLastAttack > 1500) { // Only 1.5 seconds now
                this.purpleKnight.aggressionLevel = Math.min(this.purpleKnight.maxAggression, 
                    this.purpleKnight.aggressionLevel + 2); // 4x faster buildup
            }
            
            // Harsher penalty for excessive blocking
            if (this.purpleKnight.consecutiveBlocks > 2) { // Trigger earlier
                this.knightAgent.updateQ(this.purpleKnight.lastState, 'block', -25, knightState); // Bigger penalty
            }
            
            // Additional aggression bonus when hero is close but not attacking
            if (knightState.distBin === 'close' && knightState.heroAction === 'idle') {
                this.purpleKnight.aggressionLevel = Math.min(this.purpleKnight.maxAggression, 
                    this.purpleKnight.aggressionLevel + 1);
            }

            // --- DISTANCE CLOSING PRIORITY SYSTEM ---
            // MASSIVE penalties for being far away and not approaching
            if (this.purpleKnight.lastState && knightState.distBin === 'far') {
                if (this.purpleKnight.lastAction !== 'approach') {
                    this.knightAgent.updateQ(this.purpleKnight.lastState, this.purpleKnight.lastAction, -30, knightState); // Huge penalty for not approaching when far
                }
                // Additional distance penalty - being far is bad
                this.knightAgent.updateQ(this.purpleKnight.lastState, this.purpleKnight.lastAction, -10, knightState);
            }
            
            // Medium distance should prioritize getting closer or lunging
            if (this.purpleKnight.lastState && knightState.distBin === 'medium') {
                if (!['approach', 'lunge_left', 'lunge_right', 'attack'].includes(this.purpleKnight.lastAction)) {
                    this.knightAgent.updateQ(this.purpleKnight.lastState, this.purpleKnight.lastAction, -15, knightState); // Penalty for passive actions at medium range
                }
            }
            
            // STRONG penalty for idle behavior - encourage action
            if (this.purpleKnight.lastAction === 'idle') {
                let idlePenalty = -40; // Increased base idle penalty
                
                // Increase penalty based on distance - farther = worse
                if (knightState.distBin === 'far') idlePenalty = -60; // Massive penalty when far and idle
                else if (knightState.distBin === 'medium') idlePenalty = -50; // Heavy penalty at medium distance
                else if (knightState.distBin === 'close') idlePenalty = -45; // Still heavy penalty when close
                
                this.knightAgent.updateQ(this.purpleKnight.lastState, 'idle', idlePenalty, knightState);
            }
            // --- End Penalties ---

            this.purpleKnight.lastState = knightState; // Store state
            let knightAction = this.knightAgent.chooseAction(knightState);
            
            // ELIMINATE IDLE: Always override idle actions with aggressive alternatives
            if (knightAction === 'idle') {
                const nonIdleActions = KNIGHT_ACTIONS.filter(action => action !== 'idle');
                knightAction = nonIdleActions[Math.floor(Math.random() * nonIdleActions.length)];
                
                // Apply immediate penalty for even attempting to idle
                this.knightAgent.updateQ(knightState, 'idle', -50, knightState);
            }
            
            this.purpleKnight.lastAction = knightAction; // Store action
            
            // ENHANCED REWARD SYSTEM - Prioritize distance closing
            if (knightAction !== 'idle' && knightAction !== 'block') {
                let actionReward = 8; // Increased base reward for taking action
                
                // MASSIVE bonuses for distance-closing actions
                if (knightAction === 'approach') {
                    if (knightState.distBin === 'far') actionReward += 20; // Huge reward for approaching when far
                    else if (knightState.distBin === 'medium') actionReward += 15; // Good reward for approaching when medium
                    else actionReward += 10; // Still good when close
                }
                
                if (knightAction === 'attack' && knightState.distBin === 'close') actionReward += 15; // Big reward for attacking when close
                
                if ((knightAction === 'lunge_left' || knightAction === 'lunge_right')) {
                    if (knightState.distBin === 'medium') actionReward += 12; // Good reward for lunging at medium distance
                    else if (knightState.distBin === 'far') actionReward += 8; // Some reward for lunging when far
                }
                
                // Apply the reward immediately for taking action
                this.knightAgent.updateQ(knightState, knightAction, actionReward, knightState);
            }
            
            this.executeKnightAction(knightAction);
            
            // Aggressive knights act faster - scale cooldown based on aggression
            const baseCooldown = 50;
            const aggressionSpeedup = Math.max(0.3, 1 - (this.purpleKnight.aggressionLevel / 300));
            this.purpleKnight.actionCooldown = baseCooldown * aggressionSpeedup;
        }

                // --- Handle Knight's Ongoing Movement ---
        const knight = this.purpleKnight;
        if (knight.currentMovement && knight.movementDuration > 0) {
            knight.movementDuration -= delta;
            
            if (knight.currentMovement === 'approach') {
                const angleToHero = Phaser.Math.Angle.Between(knight.x, knight.y, this.hero.x, this.hero.y);
                const direction = this.getDirectionFromAngle(angleToHero);
                knight.facing = direction; // ALWAYS update facing during movement
                const knightSpeed = 5;

                const moveVector = new Phaser.Math.Vector2(Math.cos(angleToHero), Math.sin(angleToHero)).scale(knightSpeed);
                knight.setStatic(false);
                knight.setVelocity(moveVector.x, moveVector.y);
                
                // Mark that this is intentional movement to prevent anti-push system interference
                knight.intentionalMovement = true;

                const walkAnimKey = `walk-${direction}`;
                if (knight.anims.currentAnim?.key !== walkAnimKey) {
                    knight.anims.play(walkAnimKey, true);
                }
            } else if (knight.currentMovement.startsWith('lunge')) {
                const lungeSpeed = 4;
                const moveVector = new Phaser.Math.Vector2(Math.cos(knight.movementAngle), Math.sin(knight.movementAngle)).scale(lungeSpeed);
                knight.setStatic(false);
                knight.setVelocity(moveVector.x, moveVector.y);
                
                // Mark that this is intentional movement
                knight.intentionalMovement = true;
                
                const rollAnimKey = `rolling-${knight.movementDirection}`;
                if (knight.anims.currentAnim?.key !== rollAnimKey) {
                    knight.anims.play(rollAnimKey, true);
                }
            }

            if (knight.movementDuration <= 0) {
                knight.currentMovement = null;
                knight.intentionalMovement = false; // Clear intentional movement flag
                knight.setVelocity(0, 0);
                knight.setStatic(true);

                // Ensure we face the hero when movement ends
                const angleToHero = Phaser.Math.Angle.Between(knight.x, knight.y, this.hero.x, this.hero.y);
                const direction = this.getDirectionFromAngle(angleToHero);
                knight.facing = direction;

                // Explicitly stop the current animation and switch to idle.
                const idleAnimKey = `idle-${direction}`;
                if (knight.anims.currentAnim?.key !== idleAnimKey) {
                    knight.anims.play(idleAnimKey, true);
                }
            }
        }
        // --- ALWAYS Ensure Purple Knight Faces Hero ---
        // This overrides any other facing logic to guarantee knight always looks at hero
        if (!this.purpleKnight.isDead && !this.hero.isDead) {
            const angleToHero = Phaser.Math.Angle.Between(this.purpleKnight.x, this.purpleKnight.y, this.hero.x, this.hero.y);
            const direction = this.getDirectionFromAngle(angleToHero);
            this.purpleKnight.facing = direction;
            
            // If knight is not performing an action animation, ensure it shows the correct facing idle
            if (!this.isActionInProgress(this.purpleKnight) && !this.purpleKnight.currentMovement) {
                const currentAnimKey = this.purpleKnight.anims.currentAnim?.key;
                const expectedIdleKey = `idle-${direction}`;
                
                if (currentAnimKey !== expectedIdleKey) {
                    this.purpleKnight.anims.play(expectedIdleKey, true);
                }
            }
        }
        
        // --- Character Idle & Tracking ---
        this.handleIdleAndTracking(this.hero, this.purpleKnight);
        // Skip normal tracking for purple knight since we handle it above
        
        // --- Anti-Gliding Safety Check ---
        // Ensure knight is properly static when not moving
        if (!this.purpleKnight.currentMovement && !this.purpleKnight.ominousMarchEnabled) {
            if (!this.purpleKnight.body.isStatic) {
                this.purpleKnight.setVelocity(0, 0);
                this.purpleKnight.setStatic(true);
            }
        }
        
        // Ensure no visual rotation
        this.hero.setRotation(0);
        this.purpleKnight.setRotation(0);
    }

    updateStamina(delta) {
        // Update stamina regen delay timers
        if (this.hero.staminaRegenDelay > 0) {
            this.hero.staminaRegenDelay -= delta;
        }
        if (this.purpleKnight.staminaRegenDelay > 0) {
            this.purpleKnight.staminaRegenDelay -= delta;
        }

        // Check for stamina exhaustion and disable blocking + movement
        if (this.hero.stamina <= 0 && !this.hero.blockDisabled) {
            this.hero.blockDisabled = true;
            this.hero.blockDisableTimer = 1000; // 1 second in milliseconds

            this.hero.setVelocity(0, 0); // Stop moving immediately

            // Force stop blocking animation if currently blocking
            if (this.hero.anims.currentAnim && this.hero.anims.currentAnim.key.includes('shield-block')) {
                this.hero.isBlocking = false;
                this.hero.anims.play(`idle-${this.facing}`, true);
            }
        }
        
        if (this.purpleKnight.stamina <= 0 && !this.purpleKnight.blockDisabled) {
            this.purpleKnight.blockDisabled = true;
            this.purpleKnight.blockDisableTimer = 1000; // 1 second in milliseconds

            this.purpleKnight.isBlocking = false; // Force stop blocking
            this.purpleKnight.setVelocity(0, 0); // Stop moving immediately
            this.purpleKnight.currentMovement = null; // Cancel any ongoing movement

            // Force stop blocking animation
            const direction = this.getDirectionFromAngle(Phaser.Math.Angle.Between(this.purpleKnight.x, this.purpleKnight.y, this.hero.x, this.hero.y));
            this.purpleKnight.anims.play(`idle-${direction}`, true);
        }
        
        // Update disable timers
        if (this.hero.blockDisabled) {
            this.hero.blockDisableTimer -= delta;
            if (this.hero.blockDisableTimer <= 0) {
                this.hero.blockDisabled = false;
                this.hero.stamina = 1; // Jump-start stamina recovery

            }
        }
        
        if (this.hero.movementDisabled) {
            this.hero.movementDisableTimer -= delta;
            if (this.hero.movementDisableTimer <= 0) {
                this.hero.movementDisabled = false;

            }
        }
        
        if (this.purpleKnight.blockDisabled) {
            this.purpleKnight.blockDisableTimer -= delta;
            if (this.purpleKnight.blockDisableTimer <= 0) {
                this.purpleKnight.blockDisabled = false;
                this.purpleKnight.stamina = 1; // Jump-start stamina recovery

            }
        }
        
        if (this.purpleKnight.movementDisabled) {
            this.purpleKnight.movementDisableTimer -= delta;
            if (this.purpleKnight.movementDisableTimer <= 0) {
                this.purpleKnight.movementDisabled = false;

            }
        }
        
        // Regenerate stamina for hero
        if (this.hero.stamina < this.hero.maxStamina && this.hero.staminaRegenDelay <= 0 && !this.hero.blockDisabled) {
            this.hero.stamina += this.hero.staminaRegenRate;
            this.hero.stamina = Math.min(this.hero.stamina, this.hero.maxStamina);
        }
        
        // Regenerate stamina for knight
        if (this.purpleKnight.stamina < this.purpleKnight.maxStamina && this.purpleKnight.staminaRegenDelay <= 0 && !this.purpleKnight.blockDisabled) {
            this.purpleKnight.stamina += this.purpleKnight.staminaRegenRate;
            this.purpleKnight.stamina = Math.min(this.purpleKnight.stamina, this.purpleKnight.maxStamina);
        }

        // Always update stamina bars for immediate feedback
        this.updateStaminaBar();
        this.updateKnightStaminaBar();
    }

    displayEvent(event) {
        const eventsContent = document.getElementById('events-content');
        if (!eventsContent) return;
        
        // Create formatted event display
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event-item';
        
        // Format the JSON prettily
        const formattedEvent = {
            time: Math.round(event.t),
            actor: event.actor,
            position: `[${Math.round(event.pos[0])}, ${Math.round(event.pos[1])}]`,
            direction: event.dir,
            health: `${Math.round(event.hp * 100)}%`,
            action: event.action
        };
        
        eventDiv.textContent = JSON.stringify(formattedEvent, null, 2);
        
        // Add to top of events panel
        eventsContent.insertBefore(eventDiv, eventsContent.firstChild);
        
        // Keep only last 10 events visible
        while (eventsContent.children.length > 10) {
            eventsContent.removeChild(eventsContent.lastChild);
        }
    }



    updatePlayerDebugInfo() {
        if (!this.keys || !this.debugKeys) return;
        
        const keys = this.debugKeys;
        
        // Determine current action based on actual key states
        let currentAction = 'idle';
        if (this.hero && this.hero.isAttacking) {
            currentAction = `attacking (${this.hero.currentAttackType || 'unknown'})`;
        } else if (keys.B.isDown) {
            currentAction = 'blocking';
        } else if (keys.Q.isDown) {
            currentAction = 'melee attack';
        } else if (keys.E.isDown) {
            currentAction = 'rolling';
        } else if (keys.R.isDown) {
            currentAction = 'kick';
        } else if (keys.F.isDown) {
            currentAction = 'melee2';
        } else if (keys.C.isDown) {
            currentAction = 'special1';
        } else if (keys.V.isDown) {
            currentAction = 'front-flip';
        }
        
        // Determine movement based on actual key states
        let movement = 'stationary';
        if (keys.W.isDown || keys.A.isDown || keys.S.isDown || keys.D.isDown) {
            const speed = keys.SPACE.isDown ? 'running' : 'walking';
            const dirs = [];
            if (keys.W.isDown) dirs.push('up');
            if (keys.S.isDown) dirs.push('down');
            if (keys.A.isDown) dirs.push('left');
            if (keys.D.isDown) dirs.push('right');
            movement = `${speed} (${dirs.join('+')})`;
        }
        
        // Safely update debug panel
        const actionEl = document.getElementById('debug-player-action');
        const facingEl = document.getElementById('debug-player-facing');
        const movementEl = document.getElementById('debug-player-movement');
        
        if (actionEl) actionEl.textContent = currentAction;
        if (facingEl) facingEl.textContent = this.facing || '-';
        if (movementEl) movementEl.textContent = movement;
    }



    takeScreenshot() {
        // Exit if the game is over
        if (this.gameOverActive) {
            return;
        }

        const mainCanvas = this.game.canvas;
        const screenshotCanvas = document.getElementById('screenshot-canvas');

        if (!screenshotCanvas) {
            return;
        }

        // 1. Capture screenshot
        screenshotCanvas.width = mainCanvas.width;
        screenshotCanvas.height = mainCanvas.height;
        const context = screenshotCanvas.getContext('2d');
        context.drawImage(mainCanvas, 0, 0, mainCanvas.width, mainCanvas.height);
        const imageData = screenshotCanvas.toDataURL('image/png');

        // 2a. Create event snapshot for the Hero
        const heroState = {
            t: this.time.now,
            actor: this.hero.label,
            pos: [this.hero.x, this.hero.y],
            dir: this.directionMap.get(this.facing),
                hp: this.hero.health / this.hero.maxHealth,
            stamina: this.hero.stamina / this.hero.maxStamina,
            action: (this.hero.anims.currentAnim ? this.hero.anims.currentAnim.key : 'idle')
        };

        // 2b. Create event snapshot for the Purple Knight
        const knightState = {
            t: this.time.now,
            actor: this.purpleKnight.label,
            pos: [this.purpleKnight.x, this.purpleKnight.y],
            dir: this.directionMap.get(this.purpleKnight.facing),
                hp: this.purpleKnight.health / this.purpleKnight.maxHealth,
            stamina: this.purpleKnight.stamina / this.purpleKnight.maxStamina,
            action: (this.purpleKnight.anims.currentAnim ? this.purpleKnight.anims.currentAnim.key : 'idle')
        };

        // 3. Package everything into a single payload
        const payload = {
            type: 'game_state_snapshot',
                image: imageData,
            hero_state: heroState,
            knight_state: knightState
        };

        // 4. Send the payload to the backend API via HTTP POST
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

const config = {
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
            enableSleep: false,       // keep bodies active
            positionIterations: 6,    // CCD robustness
            velocityIterations: 6
        }
    },
    scene: [PlayScene]
};

const game = new Phaser.Game(config); 