#!/usr/bin/env python3
"""
Cache Buster for Minecraft Bedrock Addons
Validates JSON, bumps versions, generates new UUIDs, and deploys packs
"""

import json
import uuid
import shutil
import sys
from pathlib import Path

# Define paths
PROJECT_ROOT = Path(__file__).parent.parent
BP_PATH = PROJECT_ROOT / "packs" / "QuestSystemBP"
RP_PATH = PROJECT_ROOT / "packs" / "QuestSystemRP"
WORLD_PATH = PROJECT_ROOT / "worlds" / "Super Quester World"

# Windows cache paths (try multiple locations)
WINDOWS_CACHE_LOCATIONS = [
    # Actual Minecraft Bedrock location (uses glob for numeric user ID)
    Path.home() / "AppData" / "Roaming" / "Minecraft Bedrock",
    # Fallback: UWP location
    Path.home() / "AppData" / "Local" / "Packages" / "Microsoft.MinecraftUWP_8wekyb3d8bbwe" / "LocalState" / "games" / "com.mojang"
]


def validate_json(file_path):
    """Validate a JSON file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            json.load(f)
        return True
    except json.JSONDecodeError as e:
        print(f"❌ JSON Error in {file_path}: {e}")
        return False
    except Exception as e:
        print(f"❌ Error reading {file_path}: {e}")
        return False


def find_all_json_files(pack_path):
    """Find all JSON files in a pack"""
    return list(pack_path.rglob("*.json"))


def bump_version(manifest_path):
    """Bump the patch version in a manifest"""
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    
    # Bump header version
    manifest['header']['version'][2] += 1
    
    # Bump module versions
    for module in manifest.get('modules', []):
        module['version'][2] += 1
    
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    
    return manifest['header']['version']


def generate_new_uuids(manifest_path):
    """Generate new UUIDs for cache busting"""
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    
    # Store old header UUID (needed for RP dependency update)
    old_header_uuid = manifest['header']['uuid']
    
    # Generate new header UUID
    manifest['header']['uuid'] = str(uuid.uuid4())
    
    # Generate new module UUIDs
    for module in manifest.get('modules', []):
        module['uuid'] = str(uuid.uuid4())
    
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    
    return old_header_uuid, manifest['header']['uuid']


def update_rp_dependency(rp_manifest_path, new_bp_uuid):
    """Update resource pack dependency to reference new behavior pack UUID"""
    with open(rp_manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    
    # Update dependency to new BP UUID
    for dep in manifest.get('dependencies', []):
        if 'uuid' in dep:  # BP dependency uses UUID, not module_name
            dep['uuid'] = new_bp_uuid
    
    with open(rp_manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)


def copy_pack(src, dest, pack_type):
    """Copy pack to destination"""
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest)
    print(f"✅ Copied {pack_type} to {dest}")


def update_world_pack_configs():
    """Update world pack configuration files with current UUIDs and versions"""
    # Read BP manifest
    with open(BP_PATH / "manifest.json", 'r', encoding='utf-8') as f:
        bp_manifest = json.load(f)
    
    # Read RP manifest
    with open(RP_PATH / "manifest.json", 'r', encoding='utf-8') as f:
        rp_manifest = json.load(f)
    
    # Create world_behavior_packs.json
    bp_config = [
        {
            "pack_id": bp_manifest['header']['uuid'],
            "version": bp_manifest['header']['version']
        }
    ]
    
    bp_config_path = WORLD_PATH / "world_behavior_packs.json"
    with open(bp_config_path, 'w', encoding='utf-8') as f:
        json.dump(bp_config, f, indent=2)
    print(f"✅ Updated {bp_config_path.name}")
    
    # Create world_resource_packs.json
    rp_config = [
        {
            "pack_id": rp_manifest['header']['uuid'],
            "version": rp_manifest['header']['version']
        }
    ]
    
    rp_config_path = WORLD_PATH / "world_resource_packs.json"
    with open(rp_config_path, 'w', encoding='utf-8') as f:
        json.dump(rp_config, f, indent=2)
    print(f"✅ Updated {rp_config_path.name}")


def clear_windows_cache():
    """Clear Minecraft Bedrock cache on Windows"""
    cache_cleared = False
    
    for base_path in WINDOWS_CACHE_LOCATIONS:
        if not base_path.exists():
            continue
        
        # For Roaming/Minecraft Bedrock, use glob to find user ID folders
        if "Minecraft Bedrock" in str(base_path):
            # Look for Users/*/games/com.mojang/minecraftpe
            user_folders = list(base_path.glob("Users/*/games/com.mojang"))
            
            if not user_folders:
                continue
            
            for user_folder in user_folders:
                cache_targets = [
                    user_folder / "minecraftpe",
                    user_folder / "development_behavior_packs",
                    user_folder / "development_resource_packs"
                ]
                
                for target in cache_targets:
                    if target.exists():
                        try:
                            shutil.rmtree(target)
                            print(f"✅ Cleared cache: {target}")
                            cache_cleared = True
                        except Exception as e:
                            print(f"⚠️  Could not clear {target.name}: {e}")
        else:
            # UWP location - direct paths
            cache_targets = [
                base_path / "minecraftpe",
                base_path / "development_behavior_packs",
                base_path / "development_resource_packs"
            ]
            
            for target in cache_targets:
                if target.exists():
                    try:
                        shutil.rmtree(target)
                        print(f"✅ Cleared cache: {target}")
                        cache_cleared = True
                    except Exception as e:
                        print(f"⚠️  Could not clear {target.name}: {e}")
    
    if not cache_cleared:
        print(f"⚠️  No cache folders found in any known locations")
    
    return cache_cleared


def main():
    print("=" * 60)
    print("🔧 CACHE BUSTER - Minecraft Bedrock Addon Deployment")
    print("=" * 60)
    
    # Step 1: Validate all JSON files
    print("\n📋 Step 1: Validating JSON files...")
    all_valid = True
    
    for pack_path, pack_name in [(BP_PATH, "Behavior Pack"), (RP_PATH, "Resource Pack")]:
        json_files = find_all_json_files(pack_path)
        print(f"\n  {pack_name}: {len(json_files)} JSON files")
        for json_file in json_files:
            if validate_json(json_file):
                print(f"    ✓ {json_file.relative_to(PROJECT_ROOT)}")
            else:
                all_valid = False
    
    if not all_valid:
        print("\n❌ JSON validation failed. Fix errors before deploying.")
        sys.exit(1)
    
    print("\n✅ All JSON files validated successfully")
    
    # Step 2: Bump versions
    print("\n📈 Step 2: Bumping versions...")
    bp_version = bump_version(BP_PATH / "manifest.json")
    rp_version = bump_version(RP_PATH / "manifest.json")
    print(f"  ✅ Behavior Pack: {'.'.join(map(str, bp_version))}")
    print(f"  ✅ Resource Pack: {'.'.join(map(str, rp_version))}")
    
    # Step 3: Generate new UUIDs
    print("\n🆔 Step 3: Generating new UUIDs for cache busting...")
    old_bp_uuid, new_bp_uuid = generate_new_uuids(BP_PATH / "manifest.json")
    old_rp_uuid, new_rp_uuid = generate_new_uuids(RP_PATH / "manifest.json")
    print(f"  ✅ New BP Header UUID: {new_bp_uuid}")
    print(f"  ✅ New RP Header UUID: {new_rp_uuid}")
    
    # Update RP dependency to reference new BP UUID
    update_rp_dependency(RP_PATH / "manifest.json", new_bp_uuid)
    print(f"  ✅ Updated RP dependency to reference new BP UUID")
    
    # Step 4: Deploy packs
    print("\n📦 Step 4: Deploying packs to world...")
    bp_dest = WORLD_PATH / "behavior_packs" / "QuestSystemBP"
    rp_dest = WORLD_PATH / "resource_packs" / "QuestSystemRP"
    
    copy_pack(BP_PATH, bp_dest, "Behavior Pack")
    copy_pack(RP_PATH, rp_dest, "Resource Pack")
    
    # Step 5: Update world pack configs
    print("\n🔗 Step 5: Updating world pack configurations...")
    update_world_pack_configs()
    
    # Step 6: Clear cache (Windows only)
    print("\n🧹 Step 6: Clearing cache...")
    cache_was_cleared = False
    if sys.platform == "win32":
        cache_was_cleared = clear_windows_cache()
    else:
        print("  ⚠️  Cache clearing only supported on Windows")
    
    print("\n" + "=" * 60)
    print("✅ DEPLOYMENT COMPLETE")
    print("=" * 60)
    print("\n📝 Summary:")
    print(f"  • BP Version: {'.'.join(map(str, bp_version))}")
    print(f"  • RP Version: {'.'.join(map(str, rp_version))}")
    print(f"  • Packs deployed to: {WORLD_PATH.relative_to(PROJECT_ROOT)}")
    if sys.platform == "win32":
        print(f"  • Cache cleared: {'Yes' if cache_was_cleared else 'No (not found)'}")
    else:
        print(f"  • Cache cleared: N/A (non-Windows)")
    print("\n🎮 Ready to test! Start your Minecraft server.\n")


if __name__ == "__main__":
    main()
