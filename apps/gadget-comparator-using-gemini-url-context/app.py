import streamlit as st
from google import genai
from google.genai.types import Tool, GenerateContentConfig

# Initialize the client
def initialize_client(api_key):
    client = genai.Client(api_key=api_key)
    return client

# Generate comparison report
def generate_comparison_report(client, model_id, urls, user_requirements):
    tools = [{"url_context": {}}]
    prompt = f"Compare the following products using given product urls , give a short explanation and comparison table based on various features for the given product urls  and as conclusion , suggest the best product out of those  to the user based on user's requirements: {user_requirements}\n"
    for url in urls:
        prompt += f"{url}  and  "

    response = client.models.generate_content(
        model=model_id,
        contents=prompt,
        config=GenerateContentConfig(
            tools=tools
        )
    )

    return response

# Main Streamlit app
def main():
    st.title("🚀 Tech Product Comparison and Suggestion Tool")
    st.subheader("🤔 Confused  about  which  Laptop ,  Phone ,  or  Tech product is better? ")
    st.markdown("🎯 Here's the solution! 🎯")
    st.divider()
    st.markdown("Drop the URLs and see the magic happen!")
    with st.sidebar:
        st.markdown(
            "<div style='text-align: center; margin: 2px 0;'>"
            "<a href='https://www.buildfastwithai.com/' target='_blank' style='text-decoration: none;'>"
            "<div style='border: 2px solid #e0e0e0; border-radius: 6px; padding: 4px; "
            "background: linear-gradient(145deg, #ffffff, #f5f5f5); "
            "box-shadow: 0 2px 6px rgba(0,0,0,0.1); "
            "transition: all 0.3s ease; display: inline-block; width: 100%;'>"
            "<img src='https://github.com/Shubhwithai/chat-with-qwen/blob/main/company_logo.png?raw=true' "
            "style='width: 100%; max-width: 100%; height: auto; border-radius: 8px; display: block;' "
            "alt='Build Fast with AI Logo'>"
            "</div></a></div>", unsafe_allow_html=True
        )

        st.header("🔐 API Settings")
        api_key = st.text_input("🔑 Enter your Gemini API key", type="password")
        st.markdown("---")
        st.markdown("Model: `gemini-2.5-flash`")
        st.markdown("---")
        st.info("For the best results, provide direct URLs to the content you want the model to analyze. The model will only retrieve content from the URLs you provide, not any content from nested links.")
        st.info("Verify that the URLs you provide don't lead to pages that require a login or are behind a paywall.")
        st.info("Provide the full URL (e.g., https://www.google.com instead of just google.com).")
        st.markdown("""<div class="sidebar-footer">
            <p>❤️ Built by <a href="https://buildfastwithai.com" target="_blank">Build Fast with AI</a></p>
        </div> """, unsafe_allow_html=True)


    if not api_key:
        st.warning("🔑 Please enter your Gemini API key.")
        st.stop()

    client = initialize_client(api_key)

    # Ask user how many products to compare
    st.subheader("📈 How many products do you want to compare?")
    num_products = st.number_input("Number of products", min_value=2, max_value=10, value=2)

    # Create text boxes for URLs
    urls = []
    st.subheader("🌐 Enter the URLs for each product")
    st.info("Check the instructions in the sidebar before entering URLs")
    for i in range(num_products):
        url = st.text_input(f"🌐 URL for product {i+1}")
        urls.append(url)

    # Ask for user-specific requirements
    st.subheader("📝 Enter any specific requirements or parameters you want the products to be judged on")
    user_requirements = st.text_area("📝 Specific requirements")

    # Generate comparison report
    if st.button("📊 Generate Comparison Report"):
        if not all(urls):
            st.warning("🌐 Please enter all URLs.")
            return
        if not user_requirements:
            st.warning("📝 Please enter your specific requirements.")
            return

        model_id = "gemini-2.5-flash"
        response = generate_comparison_report(client, model_id, urls, user_requirements)

        # Display the comparison report
        st.markdown("### 📝 Comparison and Suggestions")
        st.write("Here's a detailed comparison based on your requirements:")

        for each in response.candidates[0].content.parts:
            st.write(each.text)

if __name__ == "__main__":
    main()