#pragma once

#include <string>
#include <functional>
#include <memory>

namespace studyhive {
namespace core {

enum class Engine {
    LLM,     // On-device LLM with llama.cpp
    RULES    // Deterministic rule engine
};

enum class ConnectivityStatus {
    UNKNOWN,
    ONLINE,
    OFFLINE
};

struct EngineConfig {
    std::string model_path;
    std::string grammar_path;
    int max_tokens = 2048;
    float temperature = 0.7f;
    int seed = 42;
    bool force_rules_only = false;
};

class EngineSelector {
public:
    EngineSelector();
    ~EngineSelector();

    // Initialize the selector with configuration
    bool initialize(const EngineConfig& config);

    // Choose the appropriate engine based on model availability and connectivity
    Engine chooseEngine();

    // Check if the local LLM model is installed and valid
    bool isModelInstalled() const;

    // Get current connectivity status
    ConnectivityStatus getConnectivityStatus() const;

    // Set connectivity status (called by platform-specific monitors)
    void setConnectivityStatus(ConnectivityStatus status);

    // Check if model download is queued
    bool isModelDownloadQueued() const;

    // Queue model download (when online)
    void queueModelDownload();

    // Clear model download queue
    void clearModelDownloadQueue();

    // Get model download progress (0.0 to 1.0)
    float getModelDownloadProgress() const;

    // Set model download progress callback
    void setDownloadProgressCallback(std::function<void(float)> callback);

    // Force engine selection (for testing or user preference)
    void forceEngine(Engine engine);

    // Reset to automatic selection
    void resetToAutomatic();

    // Get current engine status for UI
    struct EngineStatus {
        Engine current_engine;
        bool ai_boost_enabled;
        bool model_available;
        ConnectivityStatus connectivity;
        bool download_queued;
        float download_progress;
    };
    
    EngineStatus getStatus() const;

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace core
} // namespace studyhive
