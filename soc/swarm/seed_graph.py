from neo4j import GraphDatabase
import time

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "password123")

def seed_database():
    print("Connecting to Neo4j to seed Kubernetes infrastructure graph...")
    # Wait for Neo4j to be ready
    time.sleep(2) 
    
    with GraphDatabase.driver(URI, auth=AUTH) as driver:
        with driver.session() as session:
            # Clear existing data
            session.run("MATCH (n) DETACH DELETE n")
            
            # Create our infrastructure map
            cypher_query = """
            CREATE (c:Cluster {name: 'kind-cluster'})
            CREATE (n:Node {name: 'worker-1', ip: '192.168.1.10'})
            CREATE (p:Pod {name: 'victim-pod', pid: 442644, namespace: 'default'})
            CREATE (role:IAMRole {name: 'S3_Admin_Role', permissions: 's3:PutObject, s3:DeleteObject'})
            CREATE (secret:Secret {name: 'prod-db-credentials'})
            
            // Define the Blast Radius relationships
            CREATE (p)-[:RUNS_ON]->(n)
            CREATE (n)-[:BELONGS_TO]->(c)
            CREATE (p)-[:ASSUMES_ROLE]->(role)
            CREATE (p)-[:HAS_ACCESS_TO]->(secret)
            """
            session.run(cypher_query)
            print("✅ Successfully seeded Neo4j with Infrastructure Graph!")

if __name__ == "__main__":
    seed_database()
