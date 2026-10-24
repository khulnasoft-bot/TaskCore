//! Controller-selected task environment; mirrors configured-environment.ts.
use crate::local_runner::LocalRunnerError;
use std::process::Command;

const MARKER: &str = "TASKCORE_CONFIGURED_ENV_KEYS";
const RESERVED: &[&str] = &[
    "AGENT_HOME",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "AWS_BEARER_TOKEN_BEDROCK",
    "BASH_ENV",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "CODEX_API_KEY",
    "CODEX_HOME",
    "COPILOT_GITHUB_TOKEN",
    "CURSOR_API_KEY",
    "CURSOR_AUTH_TOKEN",
    "ENV",
    "GH_ENTERPRISE_TOKEN",
    "GH_TOKEN",
    "GITHUB_ENTERPRISE_TOKEN",
    "GITHUB_TOKEN",
    "HOME",
    "NODE_OPTIONS",
    "NODE_PATH",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "TASKCORE_ACPX_CREDENTIAL_BINDING",
    "TASKCORE_AGENT_ID",
    "TASKCORE_AGENT_KEY_ID",
    "TASKCORE_AGENT_MESSAGE_KEY",
    "TASKCORE_AGENT_PRIVATE_KEY",
    "TASKCORE_AGENT_PUBLIC_KEY",
    "TASKCORE_AI_PROVIDER_KEY",
    "TASKCORE_API_BRIDGE_MODE",
    "TASKCORE_API_KEY",
    "TASKCORE_API_URL",
    "TASKCORE_APPROVAL_ID",
    "TASKCORE_APPROVAL_STATUS",
    "TASKCORE_COMPANY_ID",
    "TASKCORE_CONFIGURED_ENV_KEYS",
    "TASKCORE_EXECUTION_MODE",
    "TASKCORE_EXTERNAL_CHAT_EXECUTION_BOUND_KEY",
    "TASKCORE_GITHUB_AUTH_MODE",
    "TASKCORE_GITHUB_BRIDGE_TOKEN",
    "TASKCORE_GITHUB_BROKER_TOKEN",
    "TASKCORE_GITHUB_BROKER_URL",
    "TASKCORE_GITHUB_HOST_HOME",
    "TASKCORE_GITHUB_LAUNCHER_DIR",
    "TASKCORE_GIT_METADATA_ROOTS",
    "TASKCORE_GIT_TOKEN",
    "TASKCORE_HARNESS_CHECKOUT_KEY",
    "TASKCORE_INSTANCE_ID",
    "TASKCORE_LINKED_ISSUE_IDS",
    "TASKCORE_NATIVE_MCP_NAME",
    "TASKCORE_NATIVE_MCP_TOKEN",
    "TASKCORE_NATIVE_MCP_URL",
    "TASKCORE_NORMALIZED_SESSION_ID",
    "TASKCORE_PROVIDER_TRACE_MAX_BYTES",
    "TASKCORE_PROVIDER_TRACE_PATH",
    "TASKCORE_RUNNER_BOOTSTRAP_TICKET",
    "TASKCORE_RUNNER_EXTERNAL_SANDBOX",
    "TASKCORE_RUNNER_INSTANCE_ID",
    "TASKCORE_RUNNER_NETWORK_ACCESS",
    "TASKCORE_RUNNER_NETWORK_ROOTS",
    "TASKCORE_RUNTIME_PRIMARY_URL",
    "TASKCORE_RUNTIME_SERVICES_JSON",
    "TASKCORE_RUNTIME_SERVICE_INTENTS_JSON",
    "TASKCORE_RUN_ID",
    "TASKCORE_TASK_ID",
    "TASKCORE_WAKE_COMMENT_ID",
    "TASKCORE_WAKE_PAYLOAD_JSON",
    "TASKCORE_WAKE_REASON",
    "TASKCORE_WORKSPACES_JSON",
    "TASKCORE_WORKSPACE_AUTHORITATIVE_ROOT",
    "TASKCORE_WORKSPACE_BRANCH",
    "TASKCORE_WORKSPACE_CWD",
    "TASKCORE_WORKSPACE_ID",
    "TASKCORE_WORKSPACE_REALIZATION_MODE",
    "TASKCORE_WORKSPACE_REPO_REF",
    "TASKCORE_WORKSPACE_REPO_URL",
    "TASKCORE_WORKSPACE_SOURCE",
    "TASKCORE_WORKSPACE_WORKTREE_PATH",
    "PATH",
    "PERL5LIB",
    "PERL5OPT",
    "PYTHONHOME",
    "PYTHONPATH",
    "RUBYLIB",
    "RUBYOPT",
    "SHELL",
    "USERPROFILE",
    "XAI_API_KEY",
];

fn eligible_key(key: &str) -> bool {
    let upper = key.to_ascii_uppercase();
    !key.is_empty()
        && key.len() <= 128
        && key
            .bytes()
            .enumerate()
            .all(|(i, b)| b == b'_' || b.is_ascii_alphabetic() || (i > 0 && b.is_ascii_digit()))
        && !RESERVED.contains(&upper.as_str())
        && ![
            "LD_",
            "DYLD_",
            "GIT_CONFIG_",
            "TASKCORE_RUNNER_",
            "TASKCORE_NATIVE_",
            "TASKCORE_GITHUB_",
            "TASKCORE_ACPX_",
            "TASKCORE_VERIFIED_",
        ]
        .iter()
        .any(|prefix| upper.starts_with(prefix))
}

pub(crate) fn apply_configured_environment(
    command: &mut Command,
    lookup: impl Fn(&str) -> Option<String>,
) -> Result<(), LocalRunnerError> {
    let Some(raw) = lookup(MARKER) else {
        return Ok(());
    };
    let invalid = || LocalRunnerError::invalid("invalid configured environment projection");
    if raw.len() > 20_000 {
        return Err(invalid());
    }
    let mut names: Vec<String> = serde_json::from_str(&raw).map_err(|_| invalid())?;
    if names.len() > 128 || names.iter().any(|name| !eligible_key(name)) {
        return Err(invalid());
    }
    names.sort();
    if names.windows(2).any(|pair| pair[0] == pair[1]) {
        return Err(invalid());
    }
    let mut bytes = 0;
    // Validate all values before modifying the child launch specification.
    let mut values = Vec::new();
    for name in &names {
        let value = lookup(name).ok_or_else(invalid)?;
        let size = name.len() + value.len();
        bytes += size;
        if value.contains('\0') || size > 65_536 || bytes > 262_144 {
            return Err(invalid());
        }
        values.push((name, value));
    }
    command.envs(values);
    command.env(
        MARKER,
        serde_json::to_string(&names).map_err(|_| invalid())?,
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    #[test]
    fn rejects_reserved_malformed_missing_and_oversized_environment() {
        for raw in [
            "not-json",
            "[1]",
            "[\"NODE_OPTIONS\"]",
            "[\"TASKCORE_API_KEY\"]",
            "[\"TASKCORE_RUNNER_BOOTSTRAP_TICKET\"]",
            "[\"OPENAI_API_KEY\"]",
            "[\"LD_PRELOAD\"]",
            "[\"bad=name\"]",
            "[\"CUSTOM\",\"CUSTOM\"]",
            "[\"MISSING\"]",
        ] {
            let mut command = Command::new("unused");
            assert!(
                apply_configured_environment(&mut command, |key| if key == MARKER {
                    Some(raw.into())
                } else {
                    None
                })
                .is_err()
            );
            assert_eq!(command.get_envs().count(), 0);
        }
        let mut command = Command::new("unused");
        assert!(
            apply_configured_environment(&mut command, |key| Some(if key == MARKER {
                "[\"CUSTOM\"]".into()
            } else {
                "x".repeat(65_536)
            }))
            .is_err()
        );
    }

    #[test]
    #[cfg(unix)]
    fn child_receives_only_selected_task_values_across_configuration_changes() {
        for secret in [None, Some("first-secret"), Some("rotated-secret"), None] {
            let mut source = BTreeMap::from([
                ("HOST_SECRET", "unbound-secret".to_string()),
                ("NODE_OPTIONS", "unbound-loader".to_string()),
            ]);
            let names = if let Some(value) = secret {
                source.insert("TASKCORE_PAGE_AWS_SECRET_ACCESS_KEY", value.into());
                vec!["TASKCORE_PAGE_AWS_SECRET_ACCESS_KEY"]
            } else {
                vec![]
            };
            source.insert(MARKER, serde_json::to_string(&names).unwrap());
            let mut command = Command::new("/bin/sh");
            command.env_clear().args(["-c", "printf '%s|%s|%s' \"$TASKCORE_PAGE_AWS_SECRET_ACCESS_KEY\" \"$HOST_SECRET\" \"$NODE_OPTIONS\""]);
            apply_configured_environment(&mut command, |key| source.get(key).cloned()).unwrap();
            let output = command.output().unwrap();
            assert!(output.status.success());
            assert_eq!(
                String::from_utf8(output.stdout).unwrap(),
                format!("{}||", secret.unwrap_or_default())
            );
        }
    }
}
