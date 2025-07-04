#!/bin/bash

# YAML parsing error handling tests
# Tests various edge cases and malformed YAML files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# Load common functions
source "$BASE_DIR/lib/common.sh"

# Test variables
TEST_DIR="$SCRIPT_DIR/yaml_test_files"
PASSED=0
FAILED=0
YAML_PARSER=""

# Create test directory
mkdir -p "$TEST_DIR"

# Initialize
init_script
log "INFO" "Starting YAML parsing tests"

# Check for YAML parser
check_yaml_parser() {
    if command -v yq &> /dev/null; then
        YAML_PARSER="yq"
        log "INFO" "Using yq for YAML parsing tests"
    elif command -v python3 &> /dev/null && python3 -c "import yaml" 2>/dev/null; then
        YAML_PARSER="python"
        log "INFO" "Using Python for YAML parsing tests"
    else
        error_exit "No YAML parser found. Please install yq or Python with PyYAML"
    fi
}

# Parse YAML function (from bulk scripts)
parse_yaml() {
    local file="$1"
    local query="$2"
    
    if [[ "$YAML_PARSER" == "yq" ]]; then
        yq eval "$query" "$file" 2>/dev/null || echo ""
    else
        python3 -c "
import yaml
import sys

try:
    with open('$file', 'r') as f:
        data = yaml.safe_load(f)

    # Parse the query
    query = '$query'
    result = data

    # Handle queries like '.parent_id', '.subgroups[0].name', etc.
    parts = query.strip('.').replace('[', '.').replace(']', '').split('.')
    for part in parts:
        if part.isdigit():
            result = result[int(part)]
        elif part:
            result = result.get(part, '')
    
    if isinstance(result, (dict, list)):
        print('')
    else:
        print(result if result is not None else '')
except Exception as e:
    print('')
" 2>/dev/null || echo ""
    fi
}

# Test function
run_test() {
    local test_name="$1"
    local test_file="$2"
    local query="$3"
    local expected="$4"
    
    log "INFO" "Running test: $test_name"
    
    local result=$(parse_yaml "$test_file" "$query")
    
    if [[ "$result" == "$expected" ]]; then
        log "SUCCESS" "$test_name passed"
        ((PASSED++))
    else
        log "ERROR" "$test_name failed. Expected: '$expected', Got: '$result'"
        ((FAILED++))
    fi
}

# Test helper to create files
create_test_file() {
    local filename="$1"
    local content="$2"
    echo "$content" > "$TEST_DIR/$filename"
}

# Check YAML parser
check_yaml_parser

# Test 1: Valid simple YAML
create_test_file "test1_valid.yaml" "parent_id: 123
name: Test Group"

run_test "Valid simple YAML" "$TEST_DIR/test1_valid.yaml" ".parent_id" "123"
run_test "Valid string value" "$TEST_DIR/test1_valid.yaml" ".name" "Test Group"

# Test 2: Nested structure
create_test_file "test2_nested.yaml" "parent_id: 456
defaults:
  visibility: private
  lfs_enabled: true
subgroups:
  - name: Group1
    path: group1
  - name: Group2
    path: group2"

run_test "Nested defaults" "$TEST_DIR/test2_nested.yaml" ".defaults.visibility" "private"
run_test "Array access" "$TEST_DIR/test2_nested.yaml" ".subgroups[0].name" "Group1"
run_test "Second array item" "$TEST_DIR/test2_nested.yaml" ".subgroups[1].path" "group2"

# Test 3: Empty file
create_test_file "test3_empty.yaml" ""
run_test "Empty file" "$TEST_DIR/test3_empty.yaml" ".parent_id" ""

# Test 4: Malformed YAML (invalid indentation)
create_test_file "test4_malformed.yaml" "parent_id: 789
  defaults:
visibility: public"

run_test "Malformed YAML" "$TEST_DIR/test4_malformed.yaml" ".parent_id" "789"
run_test "Malformed nested" "$TEST_DIR/test4_malformed.yaml" ".defaults.visibility" ""

# Test 5: Special characters
create_test_file "test5_special.yaml" 'name: "Test \"Group\" with quotes"
description: |
  Multi-line
  description with
  special chars: & % $ #
path: test-group_123'

run_test "Quoted strings" "$TEST_DIR/test5_special.yaml" ".name" 'Test "Group" with quotes'
run_test "Path with special chars" "$TEST_DIR/test5_special.yaml" ".path" "test-group_123"

# Test 6: Unicode characters
create_test_file "test6_unicode.yaml" 'name: "개발팀"
description: "フロントエンド"
emoji: "🚀 Deploy"'

run_test "Korean unicode" "$TEST_DIR/test6_unicode.yaml" ".name" "개발팀"
run_test "Japanese unicode" "$TEST_DIR/test6_unicode.yaml" ".description" "フロントエンド"
run_test "Emoji" "$TEST_DIR/test6_unicode.yaml" ".emoji" "🚀 Deploy"

# Test 7: Missing keys
create_test_file "test7_missing.yaml" "parent_id: 111
subgroups:
  - name: Group1"

run_test "Missing key" "$TEST_DIR/test7_missing.yaml" ".missing_key" ""
run_test "Missing nested key" "$TEST_DIR/test7_missing.yaml" ".subgroups[0].description" ""

# Test 8: Boolean values
create_test_file "test8_boolean.yaml" "settings:
  lfs_enabled: true
  wiki_enabled: false
  auto_devops: yes
  packages: no"

run_test "Boolean true" "$TEST_DIR/test8_boolean.yaml" ".settings.lfs_enabled" "true"
run_test "Boolean false" "$TEST_DIR/test8_boolean.yaml" ".settings.wiki_enabled" "false"
run_test "Yes as boolean" "$TEST_DIR/test8_boolean.yaml" ".settings.auto_devops" "true"
run_test "No as boolean" "$TEST_DIR/test8_boolean.yaml" ".settings.packages" "false"

# Test 9: Numbers
create_test_file "test9_numbers.yaml" "counts:
  groups: 42
  projects: 100
  rate_limit: 3.14
  negative: -10"

run_test "Integer" "$TEST_DIR/test9_numbers.yaml" ".counts.groups" "42"
run_test "Large number" "$TEST_DIR/test9_numbers.yaml" ".counts.projects" "100"
run_test "Float" "$TEST_DIR/test9_numbers.yaml" ".counts.rate_limit" "3.14"
run_test "Negative" "$TEST_DIR/test9_numbers.yaml" ".counts.negative" "-10"

# Test 10: Comments and blank lines
create_test_file "test10_comments.yaml" "# This is a comment
parent_id: 999

# Another comment
settings: # Inline comment
  # Indented comment
  visibility: private
  
  # Blank line above
  enabled: true"

run_test "File with comments" "$TEST_DIR/test10_comments.yaml" ".parent_id" "999"
run_test "Value after comments" "$TEST_DIR/test10_comments.yaml" ".settings.visibility" "private"

# Test 11: Complex nested arrays
create_test_file "test11_complex.yaml" "projects:
  - group_id: 100
    items:
      - name: proj1
        settings:
          enabled: true
      - name: proj2
        settings:
          enabled: false"

run_test "Deep nesting" "$TEST_DIR/test11_complex.yaml" ".projects[0].items[0].name" "proj1"
run_test "Deep boolean" "$TEST_DIR/test11_complex.yaml" ".projects[0].items[1].settings.enabled" "false"

# Test 12: YAML with anchors and aliases
create_test_file "test12_anchors.yaml" 'defaults: &defaults
  visibility: private
  lfs_enabled: true

group1:
  <<: *defaults
  name: Group 1

group2:
  <<: *defaults
  name: Group 2
  visibility: public'

run_test "Anchor reference" "$TEST_DIR/test12_anchors.yaml" ".group1.visibility" "private"
run_test "Override anchor" "$TEST_DIR/test12_anchors.yaml" ".group2.visibility" "public"

# Test 13: Invalid YAML syntax
create_test_file "test13_invalid.yaml" "parent_id: [123
invalid: {key: value"

run_test "Invalid syntax recovery" "$TEST_DIR/test13_invalid.yaml" ".parent_id" ""

# Test 14: Very long values
create_test_file "test14_long.yaml" "description: $(printf 'A%.0s' {1..1000})"

result=$(parse_yaml "$TEST_DIR/test14_long.yaml" ".description")
if [[ ${#result} -eq 1000 ]]; then
    log "SUCCESS" "Long value test passed"
    ((PASSED++))
else
    log "ERROR" "Long value test failed. Length: ${#result}"
    ((FAILED++))
fi

# Test 15: Edge case - null values
create_test_file "test15_null.yaml" "value1: null
value2: ~
value3:"

run_test "Null value" "$TEST_DIR/test15_null.yaml" ".value1" ""
run_test "Tilde null" "$TEST_DIR/test15_null.yaml" ".value2" ""
run_test "Empty value" "$TEST_DIR/test15_null.yaml" ".value3" ""

# Summary
echo
log "INFO" "==================== TEST SUMMARY ===================="
log "INFO" "Total tests: $((PASSED + FAILED))"
log "SUCCESS" "Passed: $PASSED"
if [[ $FAILED -gt 0 ]]; then
    log "ERROR" "Failed: $FAILED"
else
    log "INFO" "Failed: 0"
fi

# Cleanup
rm -rf "$TEST_DIR"

# Exit with appropriate code
if [[ $FAILED -gt 0 ]]; then
    exit 1
else
    log "SUCCESS" "All tests passed!"
    exit 0
fi