# Vibe-Code-Adaptive-Game-AI Project Rules

This document outlines the core architecture, conventions, and logic for the Vibe-Code-Adaptive-Game-AI project.

## Core Technologies & Structure

- **Game Engine**: The project is built using the [Phaser 3](https://phaser.io/) framework.
- **Physics**: Physics are handled by the [Matter.js](https://brm.io/matter-js/) engine, which is integrated into Phaser.
- **Primary Game File**: All core game logic resides in `src/main.js` within the `PlayScene` class.
- **AI Logic**: The AI for the `purpleKnight` is controlled by a Q-learning implementation located in `src/RL.js`.
- **Asset Directories**:
  - Character sprites are located in `assets/character/`.
  - Map and environment assets are in `assets/map/`.

## Characters & Animations

- **Player**: The player-controlled character is `this.hero`.
- **AI Opponent**: The AI-controlled opponent is `this.purpleKnight`.
- **Sprite Dimensions**: All character spritesheets are designed with a **128x128 pixel** frame size.
- **Animation Naming**: Animations are directional and must follow the strict `{animation_name}-{direction}` naming convention (e.g., `walk-n`, `melee-se`).
- **Directional Convention**: A specific 8-direction system is used. The order is critical for the `directionMap` and must be maintained: `['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne']`.

### Complete Animation List (113 total animations):

**Loaded Spritesheets (14):** `idle`, `walk`, `run`, `melee`, `rolling`, `take-damage`, `kick`, `melee2`, `special1`, `die`, `unsheath`, `shield-block-start`, `shield-block-mid`, `front-flip`

**Directional Animations (8 directions × 12 types = 96):**
- `idle-{direction}` (8 frames, 8 fps, repeats)
- `walk-{direction}` (15 frames, 15 fps, repeats)  
- `run-{direction}` (15 frames, 20 fps, repeats)
- `melee-{direction}` (15 frames, 40 fps, no repeat)
- `rolling-{direction}` (15 frames, 20 fps, no repeat)
- `take-damage-{direction}` (8 frames, 20 fps, no repeat)
- `kick-{direction}` (15 frames, 40 fps, no repeat)
- `melee2-{direction}` (15 frames, 24 fps, no repeat)
- `special1-{direction}` (15 frames, 30 fps, no repeat)
- `shield-block-start-{direction}` (4 frames, 30 fps, no repeat)
- `shield-block-mid-{direction}` (6 frames, 10 fps, repeats)
- `front-flip-{direction}` (15 frames, 45 fps, no repeat)
- `unsheath-{direction}` (15 frames reversed, 15 fps, no repeat)

**Non-directional Animations (1):**
- `die` (15 frames, 8 fps, no repeat)

### Animation Guidelines

- **NEVER** manually override `anims.msPerFrame` as it breaks global animation timing and causes gliding effects.
- Always use the global `anims.globalTimeScale` for consistent animation speed adjustments.
- The `unsheath` animation frames are played in reverse order for the victory sequence.

## Collision System

- **Collision Categories**: Matter.js uses bitwise categories for collision filtering.
  - `0x0001`: Hero
  - `0x0002`: Knight
  - `0x0004`: Walls/Obstacles
- **Collision Masks**: Masks determine what a category collides *with*.
  - **Hero Mask (`0x0006`)**: Collides with Knight (`0x0002`) and Walls (`0x0004`).
  - **Knight Mask (`0x0005`)**: Collides with Hero (`0x0001`) and Walls (`0x0004`).
  - **Wall Mask (`0x0003`)**: Collides with Hero (`0x0001`) and Knight (`0x0002`).

## Gameplay Logic

### Attack Flow

1. **Initiation**: An attack is triggered by `performAttack(attacker, attackType)`.
2. **Wind-up**: The attack animation plays and immediately pauses on the first frame for a 100ms wind-up period.
3. **Continuation**: After the wind-up, `continueAttack(attacker)` is called.
4. **Sensor Spawn**: `spawnSwordSensor(attacker, target, attackType)` is the core of hit detection. It creates a short-lived, invisible Matter.js rectangle sensor.
   - **Positioning**: The sensor is positioned directly between the attacker and the target, just inside the target's radius, to ensure an overlap.
   - **Collision Filter**: The sensor dynamically adopts the collision `category` of the `attacker`. This is crucial for ensuring the `target`'s collision `mask` will detect it.
   - **Lifetime**: The sensor and its collision listener are removed after 200ms to prevent memory leaks.
5. **Impact**: If the sensor collides with the intended `target`, `handleAttackImpact` is called to process the hit.

### Health, Damage, and Defense

- **`handleAttackImpact`**: This function is the central point for damage calculation. It considers the attack type, armor, and blocking status. It also prevents hit reactions (like knockback) if the target is defeated by the attack.
- **`applyDamage`**: This function applies the final calculated damage to the target, updates and animates the health bar, and checks for character death.
- **Blocking**: When a character is blocking, `applyDirectionalBlocking` checks if the attack is within a 120-degree frontal arc. If it is, damage is significantly reduced.
- **Armor**: Damage is reduced based on the target's armor values (`helmet`, `breastplate`, etc.). Armor has durability (`armorDur`) and becomes less effective as it takes damage.
- **Grace Period**: After taking damage, a character enters a brief `isTakingDamage` state, granting temporary immunity to prevent them from being stun-locked.

### Stamina System

- Both the `hero` and `purpleKnight` have a stamina system governing actions like attacking, blocking, and dodging.
- Using an action consumes stamina and triggers a `staminaRegenDelay`, during which stamina does not regenerate.
- The `updateStamina(delta)` function handles all regeneration logic and must be called once per frame.
- Depleting stamina makes a character "exhausted," which temporarily disables blocking. Movement is not affected.

### Death and Game Over

1. **`handleDeath`**: Manages the death of a character. The `isDead` flag is set and the character is stopped.
2. The killed character plays the `die` animation, while the victor plays the `unsheath` animation.
3. `showGameOverScreen` is called, displaying "YOU WIN"/"YOU DIED" and a restart prompt.
4. The game waits for the 'Q' key to be pressed to restart the scene.

## AI System (Both Knights)

- **Dual AI Control**: Both the `hero` and `purpleKnight` are controlled by separate Q-learning AI agents.
- **Hero Agent**: Uses action set `HERO_ACTIONS` with 8-directional movement and 3 attack types.
- **Knight Agent**: Uses action set `KNIGHT_ACTIONS` with approach, lunge, attack, block, and roll capabilities.
- **Physics Bodies**: 
  - Hero: Dynamic body that can move freely but resists pushing
  - Purple Knight: Static by default, becomes dynamic during intentional movements
- **State Calculation**: AI state determined by distance bins (close/medium/far), health levels, and opponent actions.
- **Learning Parameters**: Configurable via JSON files (`heroknight.json`, `pknight.json`) for learning rate, epsilon decay, etc.

### Movement & Physics Anti-Gliding System

- **Ominous Marching**: The knight slowly approaches the hero when `ominousMarchEnabled` is true, using consistent physics and animation.
- **Movement Cleanup**: When any movement (approach, lunge) completes, the knight:
  1. Sets velocity to zero: `setVelocity(0, 0)`
  2. Returns to static state: `setStatic(true)`
  3. Updates facing direction toward hero
  4. Switches to appropriate idle animation
- **Anti-Gliding Safety**: A safety check in the update loop ensures the knight remains static when not actively moving.
- **Animation Consistency**: Movement animations must match physics state - no manual `msPerFrame` overrides allowed.

### Robust Anti-Push System (Version 2.0)

- **Full Collisions Maintained**: Knights physically collide with each other and act as solid obstacles.
- **Collision Categories**:
  - Hero: category `0x0001`, mask `0x0006` (collides with walls AND knight)
  - Knight: category `0x0002`, mask `0x0005` (collides with walls AND hero)  
  - Walls: category `0x0004`, mask `0x0003` (collides with both knights)
- **Triple-Layer Protection**:
  1. **Predictive Movement Control**: `preventKnightPushing()` predicts future positions and stops movement that would cause pushing
  2. **Collision Event Handling**: `handleKnightCollisions()` immediately stops movement and separates knights on direct collision
  3. **Force Separation**: `separateKnights()` maintains minimum 85-90 pixel separation at all times
- **Absolute Velocity Control**: 
  - Hero velocity capped at 6 units maximum
  - Future position prediction prevents collision before it happens
  - Immediate velocity zeroing on any pushing attempt
- **Position Tracking**: Stores last valid positions for both knights to prevent invalid states
- **Heavy Mass**: Hero has mass of 50,000 for additional stability.

### Aggressive Behavior System

- **Complete Idle Elimination**: Idle actions are NEVER allowed - always overridden with aggressive alternatives.
- **Idle Initialization**: Knight Q-table starts with idle action at -100 Q-value to strongly discourage selection.
- **Forced Action Selection**: When idle is attempted, system automatically chooses:
  - `attack` if distance < 100 pixels
  - `lunge_left/lunge_right` if distance < 200 pixels  
  - `approach` if distance > 200 pixels
- **Heavy Idle Penalties**: Attempting to idle results in -50 penalty plus contextual penalties (-15 to -35).
- **Action Rewards**: Positive rewards (+5 to +10) for taking aggressive actions appropriate to the situation.
- **Context Bonuses**: Additional rewards for contextually appropriate actions (attack when close, approach when far, etc.).

### Distance-Closing Priority System

- **Purple Knight Behavior**:
  - Massive penalties (-30 to -60) for being far and not approaching
  - Huge rewards (+20 to +28) for approach actions when far from hero
  - Medium-range penalties (-15) for passive actions instead of lunging/attacking
  - Enhanced action cooldown scaling based on aggression level
- **Hero Knight Behavior**:
  - Distance penalties (-8 to -25) for being far without closing distance
  - Action biasing: 60% chance to force movement toward knight when far
  - Rewards (+12 to +27) for movement actions that close distance
  - Enhanced rewards (+18) for attacking when in close range
- **Shared Logic**:
  - Both knights prioritize aggressive distance-closing over defensive actions
  - Far distance triggers strongest penalties and movement rewards
  - Medium distance encourages lunging, approaching, or attacking
  - Close distance maximizes attack action rewards

### Always-Facing System

- **Continuous Tracking**: Purple knight ALWAYS faces the hero every frame in the update loop.
- **Action Override**: Knight facing is updated before executing any action.
- **Movement Tracking**: During approach movements, facing is continuously updated toward hero position.
- **Ominous March**: Knight maintains eye contact with hero during slow approach.
- **Animation Sync**: Idle animations automatically update to match current facing direction.
- **Priority System**: Hero-facing logic takes priority over all other facing/tracking logic.

### Reactive Defense System (Enhanced)

- **Automatic Defensive Actions**: Purple knight automatically blocks (70%) or rolls (30%) when hero attacks at close range.
- **Action Rewards**: 
  - +20 reward for blocking when hero is attacking
  - +18 reward for rolling away from attacks
  - +15 immediate reward for reactive defense
- **Stamina Management**: Rolling costs 25 stamina and provides 400ms invulnerability
- **Contextual Defense**: Different defensive rewards based on situation and distance

### Health Bar System

- **Hero Health Bar**: Located at top-left (20, 20) with green colors and white flash on damage.
- **Purple Knight Health Bar**: Located at bottom-center with purple colors (0x9400D3 main, 0xC8A2C8 highlight).
- **Smooth Damage Animation**: Purple knight health bar smoothly reduces over 200ms without flashing.
- **Consistent Styling**: Animation maintains same purple color scheme as static health bar.
- **No Flash Effects**: Removed white flash overlay to prevent visual distraction during combat.

## Debugging

- **Physics Debug (`F2`)**: Toggles the visibility of Matter.js physics bodies for static objects like walls.
- **Boundary & Sensor Debug (`X`)**: Toggles custom-drawn debug shapes:
  - Red lines for arena boundaries.
  - Blue/Green circles for character collision areas.
- **Attack Sensors**: Debug visualization for sword hit sensors has been removed to eliminate yellow debug boxes during combat.
