import hashlib
import subprocess
import json
import base64
import os

print("Starting key generation and ID calculation...")

# Directories
workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key_path = os.path.join(workspace_dir, "key.pem")
manifest_path = os.path.join(workspace_dir, "src/extension/manifest.json")
host_manifest_path = os.path.join(workspace_dir, "src/native_host/com.google.workbench.token_helper.json")

# 1. Generate private key if not exists
if not os.path.exists(key_path):
    print("Generating key.pem...")
    subprocess.run(["openssl", "genrsa", "-out", key_path, "2048"], check=True)

# 2. Extract Public Key in DER format
print("Extracting public key DER...")
der_pub = subprocess.check_output(["openssl", "rsa", "-in", key_path, "-pubout", "-outform", "DER"], stderr=subprocess.DEVNULL)

# 3. Calculate Extension ID
# SHA256 of the DER public key
sha256 = hashlib.sha256(der_pub).hexdigest()
# First 32 chars
first_32 = sha256[:32]
# Map hex (0-f) to (a-p)
mapping = str.maketrans('0123456789abcdef', 'abcdefghijklmnop')
ext_id = first_32.translate(mapping)
print(f"Calculated Extension ID: {ext_id}")

# 4. Base64 encode the DER public key for manifest.json "key" field
pub_b64 = base64.b64encode(der_pub).decode('utf-8')

# 5. Update manifest.json
print(f"Updating {manifest_path}...")
with open(manifest_path, 'r') as f:
    manifest = json.load(f)

manifest['key'] = pub_b64

with open(manifest_path, 'w') as f:
    json.dump(manifest, f, indent=2)

# 6. Update com.google.workbench.token_helper.json
print(f"Updating {host_manifest_path}...")
with open(host_manifest_path, 'r') as f:
    host_manifest = json.load(f)

# Update allowed_origins
# For Edge, it can be extension://[ID] or chrome-extension://[ID]
# We will add both to be safe
host_manifest['allowed_origins'] = [
    f"chrome-extension://{ext_id}/",
    f"extension://{ext_id}/"
]

with open(host_manifest_path, 'w') as f:
    json.dump(host_manifest, f, indent=2)

print("Key setup complete.")
print(f"Stable Extension ID: {ext_id}")
