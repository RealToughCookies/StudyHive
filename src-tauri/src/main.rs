// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
struct OllamaResponse {
    response: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct QuizRequest {
    prompt: String,
    model: String,
}

// Check if Ollama is installed and running
#[tauri::command]
async fn check_ollama_status() -> Result<String, String> {
    // Try to connect to Ollama API
    let client = reqwest::Client::new();
    match client
        .get("http://localhost:11434/api/tags")
        .send()
        .await
    {
        Ok(_) => Ok("running".to_string()),
        Err(_) => {
            // Check if Ollama is installed but not running
            if cfg!(target_os = "macos") || cfg!(target_os = "linux") {
                match Command::new("which").arg("ollama").output() {
                    Ok(output) => {
                        if output.status.success() {
                            Ok("installed".to_string())
                        } else {
                            Ok("not_installed".to_string())
                        }
                    }
                    Err(_) => Ok("not_installed".to_string()),
                }
            } else {
                Ok("not_installed".to_string())
            }
        }
    }
}

// Start Ollama service
#[tauri::command]
async fn start_ollama() -> Result<String, String> {
    if cfg!(target_os = "macos") || cfg!(target_os = "linux") {
        match Command::new("ollama").arg("serve").spawn() {
            Ok(_) => {
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                Ok("started".to_string())
            }
            Err(e) => Err(format!("Failed to start Ollama: {}", e)),
        }
    } else {
        Err("Platform not supported for auto-start".to_string())
    }
}

// Generate quiz using Ollama
#[tauri::command]
async fn generate_quiz_ollama(request: QuizRequest) -> Result<String, String> {
    let client = reqwest::Client::new();

    #[derive(Serialize)]
    struct OllamaRequest {
        model: String,
        prompt: String,
        stream: bool,
    }

    let ollama_request = OllamaRequest {
        model: request.model,
        prompt: request.prompt,
        stream: false,
    };

    match client
        .post("http://localhost:11434/api/generate")
        .json(&ollama_request)
        .send()
        .await
    {
        Ok(response) => match response.json::<OllamaResponse>().await {
            Ok(data) => Ok(data.response),
            Err(e) => Err(format!("Failed to parse response: {}", e)),
        },
        Err(e) => Err(format!("Request failed: {}", e)),
    }
}

// List available models
#[tauri::command]
async fn list_ollama_models() -> Result<String, String> {
    let client = reqwest::Client::new();

    match client
        .get("http://localhost:11434/api/tags")
        .send()
        .await
    {
        Ok(response) => match response.text().await {
            Ok(text) => Ok(text),
            Err(e) => Err(format!("Failed to read response: {}", e)),
        },
        Err(e) => Err(format!("Request failed: {}", e)),
    }
}

// Pull a model from Ollama
#[tauri::command]
async fn pull_ollama_model(model_name: String) -> Result<String, String> {
    let client = reqwest::Client::new();

    #[derive(Serialize)]
    struct PullRequest {
        name: String,
    }

    let pull_request = PullRequest { name: model_name };

    match client
        .post("http://localhost:11434/api/pull")
        .json(&pull_request)
        .send()
        .await
    {
        Ok(_) => Ok("Model pull started".to_string()),
        Err(e) => Err(format!("Failed to pull model: {}", e)),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            check_ollama_status,
            start_ollama,
            generate_quiz_ollama,
            list_ollama_models,
            pull_ollama_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
