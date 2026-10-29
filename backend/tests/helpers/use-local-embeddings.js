// Import FIRST in tests that measure semantic quality: they use the real pretrained local model.
// The model downloads from Hugging Face on first use, or set EMBEDDING_MODEL_PATH for an offline copy.
process.env.TEST_EMBEDDING_PROVIDER = 'local'
