#This is a multi stage Docker build btw :
    # Stage 1: Builds the React app
    # Stage 2: Serves the built React app using nginx


# So nginx is running inside the frontend container, not as a separate service. This works, but it's not the most flexible approach for a 3-tier architecture.
#--------------------------------------------------------------------------------------------------------------------------------------------------------------------
    
# Dockerfile for the frontend service
FROM node:18-alpine AS build 

WORKDIR /app

COPY package*.json ./
# Install dependencies
RUN npm ci 
COPY . .

# Set API URL to relative path so nginx can proxy it
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Build the app
RUN npm run build

#Production stage with nginx 
FROM nginx:alpine
# Copy the built app  from the build stage to the nginx html directory
COPY --from=build  /app/build /usr/share/nginx/html


# Copy nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose the port the app runs on
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
