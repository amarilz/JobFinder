#!/bin/bash

# Load environment variables from .env if present
if [ -f ".env" ]; then
  echo "Loading environment variables from .env..."
  set -a
  source .env
  set +a
else
  echo "Can't run without .env file"
  exit 1
fi

# Check and set the JDK path
if [ -z "$JDK_PATH" ]; then
  echo "Error: JDK_PATH variable is not set"
  exit 1
fi

export JAVA_HOME="$JDK_PATH"
export PATH="$JAVA_HOME/bin:$PATH"

# Confirm Java is available
echo "Using Java:"
java -version || { echo "Error: Java not found at $JAVA_HOME"; exit 1; }

# Check the properties file
if [ -z "$PROPERTIES_FILE" ]; then
  echo "Error: PROPERTIES_FILE variable is not set."
  exit 1
fi

if [ ! -f "$PROPERTIES_FILE" ]; then
  echo "Error: Properties file not found: $PROPERTIES_FILE"
  exit 1
fi

# Check the application JAR file
if [ -z "$JAR_FILE" ]; then
  echo "Error: JAR_FILE variable is not set."
  exit 1
fi

if [ ! -f "$JAR_FILE" ]; then
  echo "Error: JAR file not found: $JAR_FILE"
  exit 1
fi

# Print the configuration
echo ""
echo "==== Launch Configuration ===="
echo "JAVA_HOME:       $JAVA_HOME"
echo "PROPERTIES_FILE: $PROPERTIES_FILE"
echo "JAR_FILE:        $JAR_FILE"
echo ""

# Start the application
echo "Starting the application..."
java -jar "$JAR_FILE" --spring.config.location="file:$PROPERTIES_FILE"
