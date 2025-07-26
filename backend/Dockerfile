# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

#By copying requirements.txt separately from the rest of your application code, you create an isolated layer just for dependency installation.
#this one is about docker layer caching, which can speed up builds.
COPY requirements.txt .

# The --no-cache-dir flag tells pip not to store cache, which reduces image size since the cache wouldn t be useful in the final image anyway.
# this in the other hand is abt PIP cachinng .
# This is useful for production images where you want to keep the image size small.
RUN pip install --no-cache-dir -r requirements.txt   

COPY app.py .

# Create a directory for data storage
RUN mkdir -p /app/data

#expose the port the app runs on
ENV PORT=5000
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Run the application
CMD ["python", "app.py"]