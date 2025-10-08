#include "engine_selector.h"
#include <filesystem>
#include <fstream>
#include <chrono>
#include <thread>

namespace studyhive {
namespace core {

class EngineSelector::Impl {
public:
    Impl() : connectivity_status_(ConnectivityStatus::UNKNOWN),
             forced_engine_(std::nullopt),
             download_queued_(false),
             download_progress_(0.0f) {}

    bool initialize(const EngineConfig& config) {
        config_ = config;
        
        // Check if model is installed
        model_installed_ = checkModelInstallation();
        
        // Initialize connectivity monitoring (platform-specific)
        initializeConnectivityMonitoring();
        
        return true;
    }

    Engine chooseEngine() {
        // Check for forced engine selection
        if (forced_engine_.has_value()) {
            return forced_engine_.value();
        }

        // If rules-only mode is forced
        if (config_.force_rules_only) {
            return Engine::RULES;
        }

        // If model is installed, prefer LLM (works offline too)
        if (model_installed_) {
            return Engine::LLM;
        }

        // No model installed
        if (getConnectivityStatus() == ConnectivityStatus::ONLINE) {
            // Prompt to download model if not already queued
            if (!download_queued_) {
                queueModelDownload();
            }
        }
        
        // Use rules engine as fallback
        return Engine::RULES;
    }

    bool isModelInstalled() const {
        return model_installed_;
    }

    ConnectivityStatus getConnectivityStatus() const {
        return connectivity_status_;
    }

    void setConnectivityStatus(ConnectivityStatus status) {
        connectivity_status_ = status;
        
        // If we come online and have a queued download, start it
        if (status == ConnectivityStatus::ONLINE && download_queued_) {
            startModelDownload();
        }
    }

    bool isModelDownloadQueued() const {
        return download_queued_;
    }

    void queueModelDownload() {
        if (!download_queued_) {
            download_queued_ = true;
            
            // If already online, start download immediately
            if (connectivity_status_ == ConnectivityStatus::ONLINE) {
                startModelDownload();
            }
        }
    }

    void clearModelDownloadQueue() {
        download_queued_ = false;
        download_progress_ = 0.0f;
    }

    float getModelDownloadProgress() const {
        return download_progress_;
    }

    void setDownloadProgressCallback(std::function<void(float)> callback) {
        download_progress_callback_ = callback;
    }

    void forceEngine(Engine engine) {
        forced_engine_ = engine;
    }

    void resetToAutomatic() {
        forced_engine_ = std::nullopt;
    }

    EngineSelector::EngineStatus getStatus() const {
        Engine current_engine = chooseEngine();
        
        return {
            .current_engine = current_engine,
            .ai_boost_enabled = (current_engine == Engine::LLM),
            .model_available = model_installed_,
            .connectivity = connectivity_status_,
            .download_queued = download_queued_,
            .download_progress = download_progress_
        };
    }

private:
    bool checkModelInstallation() {
        if (config_.model_path.empty()) {
            return false;
        }

        std::filesystem::path model_path(config_.model_path);
        
        // Check if file exists and has reasonable size (> 100MB)
        if (!std::filesystem::exists(model_path)) {
            return false;
        }

        auto file_size = std::filesystem::file_size(model_path);
        if (file_size < 100 * 1024 * 1024) { // 100MB minimum
            return false;
        }

        // TODO: Add SHA-256 verification
        // For now, just check file existence and size
        
        return true;
    }

    void initializeConnectivityMonitoring() {
        // Platform-specific implementation will be called from iOS/Android wrappers
        // For now, assume unknown status
        connectivity_status_ = ConnectivityStatus::UNKNOWN;
    }

    void startModelDownload() {
        // TODO: Implement actual model download with progress tracking
        // This would download Phi-3 Mini Instruct GGUF model
        // For now, simulate download progress
        
        std::thread([this]() {
            for (int i = 0; i <= 100; i += 10) {
                download_progress_ = i / 100.0f;
                
                if (download_progress_callback_) {
                    download_progress_callback_(download_progress_);
                }
                
                std::this_thread::sleep_for(std::chrono::milliseconds(500));
            }
            
            // Mark model as installed
            model_installed_ = true;
            download_queued_ = false;
        }).detach();
    }

    EngineConfig config_;
    ConnectivityStatus connectivity_status_;
    bool model_installed_;
    std::optional<Engine> forced_engine_;
    bool download_queued_;
    float download_progress_;
    std::function<void(float)> download_progress_callback_;
};

// EngineSelector implementation
EngineSelector::EngineSelector() : impl_(std::make_unique<Impl>()) {}

EngineSelector::~EngineSelector() = default;

bool EngineSelector::initialize(const EngineConfig& config) {
    return impl_->initialize(config);
}

Engine EngineSelector::chooseEngine() {
    return impl_->chooseEngine();
}

bool EngineSelector::isModelInstalled() const {
    return impl_->isModelInstalled();
}

ConnectivityStatus EngineSelector::getConnectivityStatus() const {
    return impl_->getConnectivityStatus();
}

void EngineSelector::setConnectivityStatus(ConnectivityStatus status) {
    impl_->setConnectivityStatus(status);
}

bool EngineSelector::isModelDownloadQueued() const {
    return impl_->isModelDownloadQueued();
}

void EngineSelector::queueModelDownload() {
    impl_->queueModelDownload();
}

void EngineSelector::clearModelDownloadQueue() {
    impl_->clearModelDownloadQueue();
}

float EngineSelector::getModelDownloadProgress() const {
    return impl_->getModelDownloadProgress();
}

void EngineSelector::setDownloadProgressCallback(std::function<void(float)> callback) {
    impl_->setDownloadProgressCallback(callback);
}

void EngineSelector::forceEngine(Engine engine) {
    impl_->forceEngine(engine);
}

void EngineSelector::resetToAutomatic() {
    impl_->resetToAutomatic();
}

EngineSelector::EngineStatus EngineSelector::getStatus() const {
    return impl_->getStatus();
}

} // namespace core
} // namespace studyhive
