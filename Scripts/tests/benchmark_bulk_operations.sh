#!/bin/bash

# Performance benchmark for GitLab bulk operations
# Measures execution time and API call efficiency

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# Load common functions
source "$BASE_DIR/lib/common.sh"

# Benchmark configuration
BENCHMARK_DIR="$SCRIPT_DIR/benchmark_results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$BENCHMARK_DIR/benchmark_$TIMESTAMP.txt"

# Test scenarios
SMALL_SCALE=10
MEDIUM_SCALE=50
LARGE_SCALE=100

# Initialize
init_script
mkdir -p "$BENCHMARK_DIR"

# Benchmark logging
benchmark_log() {
    local message="$1"
    echo "$message" | tee -a "$RESULT_FILE"
    log "INFO" "$message"
}

# Time measurement function
measure_time() {
    local start_time=$(date +%s.%N)
    "$@"
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    echo "$duration"
}

# Create test YAML files
create_test_yaml() {
    local scale=$1
    local type=$2
    local file="$BENCHMARK_DIR/test_${type}_${scale}.yaml"
    
    case $type in
        "subgroups")
            cat > "$file" <<EOF
parent_id: \${TEST_PARENT_ID}
defaults:
  visibility: private
options:
  dry_run: true
  api_delay: 100
subgroups:
EOF
            for ((i=1; i<=scale; i++)); do
                cat >> "$file" <<EOF
  - name: "Test Group $i"
    path: "test-group-$i"
    description: "Benchmark test group $i"
EOF
                # Add nested subgroups for every 5th group
                if ((i % 5 == 0)); then
                    cat >> "$file" <<EOF
    subgroups:
      - name: "Nested Group $i-1"
        path: "nested-$i-1"
      - name: "Nested Group $i-2"
        path: "nested-$i-2"
EOF
                fi
            done
            ;;
            
        "projects")
            cat > "$file" <<EOF
defaults:
  visibility: private
  default_branch: main
options:
  dry_run: true
  api_delay: 100
projects:
  - group_id: \${TEST_GROUP_ID}
    projects:
EOF
            for ((i=1; i<=scale; i++)); do
                cat >> "$file" <<EOF
      - name: "test-project-$i"
        description: "Benchmark test project $i"
        topics: ["benchmark", "test"]
EOF
            done
            ;;
    esac
    
    echo "$file"
}

# API call counter
count_api_calls() {
    local log_file=$1
    grep -c "API 호출:" "$log_file" 2>/dev/null || echo "0"
}

# Memory usage checker
check_memory_usage() {
    if command -v ps &> /dev/null; then
        ps -o pid,vsz,rss,comm -p $$ | tail -1
    else
        echo "Memory monitoring not available"
    fi
}

# Run benchmark
run_benchmark() {
    local scale=$1
    local type=$2
    local script=$3
    local yaml_file=$4
    
    benchmark_log "=== Benchmark: $type (Scale: $scale) ==="
    
    # Check memory before
    benchmark_log "Memory before: $(check_memory_usage)"
    
    # Create temporary log file for this run
    local temp_log="$BENCHMARK_DIR/temp_${type}_${scale}.log"
    export LOG_FILE="$temp_log"
    
    # Measure execution time
    local duration=$(measure_time "$script" --config "$yaml_file" 2>&1 | tee -a "$temp_log" > /dev/null; echo ${PIPESTATUS[0]})
    
    # Count API calls
    local api_calls=$(count_api_calls "$temp_log")
    
    # Check memory after
    benchmark_log "Memory after: $(check_memory_usage)"
    
    # Calculate metrics
    local items_per_second=$(echo "scale=2; $scale / $duration" | bc 2>/dev/null || echo "N/A")
    local avg_time_per_item=$(echo "scale=3; $duration / $scale" | bc 2>/dev/null || echo "N/A")
    
    # Log results
    benchmark_log "Duration: ${duration}s"
    benchmark_log "Total API calls: $api_calls"
    benchmark_log "Items processed: $scale"
    benchmark_log "Items per second: $items_per_second"
    benchmark_log "Average time per item: ${avg_time_per_item}s"
    benchmark_log "API calls per item: $(echo "scale=2; $api_calls / $scale" | bc 2>/dev/null || echo "N/A")"
    benchmark_log ""
    
    # Clean up
    rm -f "$temp_log"
}

# Check prerequisites
check_prerequisites() {
    if [[ -z "${TEST_PARENT_ID:-}" ]] || [[ -z "${TEST_GROUP_ID:-}" ]]; then
        benchmark_log "WARNING: TEST_PARENT_ID and TEST_GROUP_ID not set"
        benchmark_log "Using mock values for dry-run benchmark"
        export TEST_PARENT_ID=999999
        export TEST_GROUP_ID=999999
    fi
    
    # Check if bc is installed for calculations
    if ! command -v bc &> /dev/null; then
        benchmark_log "WARNING: 'bc' not installed. Some calculations will be unavailable."
    fi
}

# Main benchmark execution
benchmark_log "GitLab Bulk Operations Performance Benchmark"
benchmark_log "Started at: $(date)"
benchmark_log "============================================"
benchmark_log ""

# Check prerequisites
check_prerequisites

# Run subgroups benchmarks
if [[ -f "$BASE_DIR/batch/create_subgroups_bulk.sh" ]]; then
    benchmark_log "## Subgroups Creation Benchmarks"
    
    for scale in $SMALL_SCALE $MEDIUM_SCALE $LARGE_SCALE; do
        yaml_file=$(create_test_yaml "$scale" "subgroups")
        run_benchmark "$scale" "subgroups" "$BASE_DIR/batch/create_subgroups_bulk.sh" "$yaml_file"
    done
else
    benchmark_log "WARNING: create_subgroups_bulk.sh not found"
fi

# Run projects benchmarks
if [[ -f "$BASE_DIR/batch/create_projects_bulk.sh" ]]; then
    benchmark_log "## Projects Creation Benchmarks"
    
    for scale in $SMALL_SCALE $MEDIUM_SCALE $LARGE_SCALE; do
        yaml_file=$(create_test_yaml "$scale" "projects")
        run_benchmark "$scale" "projects" "$BASE_DIR/batch/create_projects_bulk.sh" "$yaml_file"
    done
else
    benchmark_log "WARNING: create_projects_bulk.sh not found"
fi

# Summary and recommendations
benchmark_log "## Summary and Recommendations"
benchmark_log "============================================"

# Parse results and provide recommendations
if command -v awk &> /dev/null; then
    avg_time_small=$(grep -A5 "Scale: $SMALL_SCALE" "$RESULT_FILE" | grep "Average time per item:" | awk '{print $5}' | head -1)
    avg_time_large=$(grep -A5 "Scale: $LARGE_SCALE" "$RESULT_FILE" | grep "Average time per item:" | awk '{print $5}' | tail -1)
    
    if [[ -n "$avg_time_small" ]] && [[ -n "$avg_time_large" ]]; then
        benchmark_log "Performance scaling:"
        benchmark_log "- Small scale ($SMALL_SCALE items): ${avg_time_small}s per item"
        benchmark_log "- Large scale ($LARGE_SCALE items): ${avg_time_large}s per item"
        
        # Check if performance degrades with scale
        if command -v bc &> /dev/null; then
            scaling_factor=$(echo "scale=2; $avg_time_large / $avg_time_small" | bc 2>/dev/null || echo "1")
            benchmark_log "- Scaling factor: ${scaling_factor}x"
            
            if (( $(echo "$scaling_factor > 1.5" | bc -l) )); then
                benchmark_log ""
                benchmark_log "⚠️  Performance degrades with scale. Recommendations:"
                benchmark_log "   - Consider increasing batch sizes"
                benchmark_log "   - Implement parallel processing"
                benchmark_log "   - Optimize API call patterns"
            else
                benchmark_log ""
                benchmark_log "✅ Good linear scaling performance"
            fi
        fi
    fi
fi

# API efficiency analysis
total_api_calls=$(grep "Total API calls:" "$RESULT_FILE" | awk '{sum+=$4} END {print sum}')
total_items=$(grep "Items processed:" "$RESULT_FILE" | awk '{sum+=$3} END {print sum}')

if [[ -n "$total_api_calls" ]] && [[ -n "$total_items" ]] && [[ $total_items -gt 0 ]]; then
    avg_api_calls=$(echo "scale=2; $total_api_calls / $total_items" | bc 2>/dev/null || echo "N/A")
    benchmark_log ""
    benchmark_log "API Efficiency:"
    benchmark_log "- Average API calls per item: $avg_api_calls"
    
    if command -v bc &> /dev/null && [[ "$avg_api_calls" != "N/A" ]]; then
        if (( $(echo "$avg_api_calls > 2" | bc -l) )); then
            benchmark_log "- ⚠️  High API usage. Consider batch operations or caching"
        else
            benchmark_log "- ✅ Efficient API usage"
        fi
    fi
fi

# Final recommendations based on scale
benchmark_log ""
benchmark_log "Scale-based recommendations:"
benchmark_log "- For <50 items: Current approach is efficient"
benchmark_log "- For 50-500 items: Consider increasing api_delay to 200-300ms"
benchmark_log "- For >500 items: Recommend Python implementation with async support"
benchmark_log "- For >1000 items: Split into multiple runs or use dedicated ETL tool"

benchmark_log ""
benchmark_log "Benchmark completed at: $(date)"
benchmark_log "Results saved to: $RESULT_FILE"

# Cleanup test files
rm -f "$BENCHMARK_DIR"/test_*.yaml

# Display location of results
echo
log "SUCCESS" "Benchmark complete! Results saved to:"
log "INFO" "$RESULT_FILE"