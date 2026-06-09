// Singleton AIProjectClient — reused across all agent calls to avoid repeated auth handshakes.
// Uses DefaultAzureCredential locally (az login), swap to ClientSecretCredential for Vercel.

import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT!;
const client = new AIProjectClient(endpoint, new DefaultAzureCredential());

export function getClient() {
    return client;
}