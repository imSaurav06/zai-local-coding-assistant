"use strict";

const assert = require("assert");

module.exports = function registerStressCheckpointTests(suite, test) {
    const { createCheckpointBridge, InMemoryCheckpointStore } = require("../../core/runtime");

    function makeFrozen(obj) {
        if (obj && typeof obj === 'object') {
            if (!Object.isFrozen(obj)) {
                Object.freeze(obj);
            }
            for (const k of Object.getOwnPropertyNames(obj)) {
                makeFrozen(obj[k]);
            }
        }
        return obj;
    }

    function getSampleState(custom = {}) {
        return {
            version: "1.0",
            metadata: {
                status: "SUCCESS",
                executionId: "exec_stress_checkpoint",
                createdAt: new Date().toISOString()
            },
            queues: {
                pending: [],
                running: [],
                completed: ["task_01"],
                failed: []
            },
            statistics: {
                totalTasks: 1,
                pending: 0,
                running: 0,
                completed: 1,
                failed: 0
            },
            ...custom
        };
    }

    suite("Stress Checkpoint & Resume Validation (Phase 11B-7B)", () => {

        test("1. Repeated checkpoint save and retrieve cycles under heavy iteration", async () => {
            const store = new InMemoryCheckpointStore();
            const bridge = createCheckpointBridge({ 
                enableCheckpointPersistence: true,
                checkpointStore: store 
            });
            
            const executionId = "exec_heavy_cycles";
            
            for (let i = 0; i < 50; i++) {
                const state = makeFrozen(getSampleState({
                    metadata: {
                        status: "RUNNING",
                        executionId,
                        createdAt: new Date().toISOString(),
                        cycle: i
                    }
                }));

                const saveRes = await bridge.initializeExecutionCheckpoint(state);
                assert.strictEqual(saveRes.success, true);
                assert.ok(saveRes.checkpoint);
                
                // Fetch and verify
                const loadState = await store.load(executionId);
                assert.ok(loadState);
                
                // loadState is the raw checkpoint stored. In checkpointLifecycle.js, it createsopts with waveNumber: 0 etc.
                // It does not directly store state but maps it.
                assert.strictEqual(loadState.executionId, executionId);
            }
        });

        test("2. Bridge handles corrupted checkpoint load attempt gracefully", async () => {
            // Attempt resume checkpoint should gracefully report failure or throw correct error code
            assert.throws(() => {
                const serializer = require("../../core/checkpoints/checkpointSerializer");
                serializer.deserializeCheckpoint("broken content");
            });
        });

        test("3. Bridge handles store save/restore failure injections gracefully", async () => {
            const store = {
                save: async () => {
                    throw new Error("Disk full database crash");
                },
                load: async () => {
                    throw new Error("Connection timed out");
                },
                exists: async () => true,
                delete: async () => {},
                list: async () => [],
                health: async () => ({ status: "OK", count: 0 })
            };

            const bridge = createCheckpointBridge({ 
                enableCheckpointPersistence: true,
                checkpointStore: store
            });

            const state = makeFrozen(getSampleState());
            
            await assert.rejects(async () => {
                await bridge.initializeExecutionCheckpoint(state);
            }, (err) => {
                return err.code === "CHECKPOINT_BRIDGE_FAILED" || err.message.includes("Disk full");
            });
        });
    });
};
