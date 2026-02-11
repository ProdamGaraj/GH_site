SELECT id, "blockId", config->'transforms' as transforms FROM data_bindings 
WHERE "blockId" IN ('gh-premium-1769148718508-45', '0b5f15d5-bf2b-42c3-9bf6-d6edeacb643a');
