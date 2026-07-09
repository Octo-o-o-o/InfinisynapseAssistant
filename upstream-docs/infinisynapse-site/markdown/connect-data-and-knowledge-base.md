# Connect Data Sources and Knowledge Base


# How to Connect Data Sources and Knowledge Bases

## Working with Databases

As an AI data-analysis product, InfiniSynapse treats uploading and using data as its most core capability. InfiniSynapse maps arbitrary data into a database and **supports uploading 100+ data formats** — whether it is a file directory (which may contain Excel, Parquet, CSV, JSON and other files), a MySQL or Oracle instance, or a data warehouse such as Hive or Impala.

Inside InfiniSynapse, simply create a database under **Data Sources** and upload your files. After that, you can select it on the **Chat** page and start asking questions.

### Local Database

Step 1: On the home page, click **My Data** — **Data Sources**.

![Image](/connectDataSource/1.png)

Step 2: Click **Add Data Source**, fill in the name, alias, description and type, then click **Confirm**.

![Image](/connectDataSource/2.png)

Step 3: Upload local files.

Click **Upload File** in the action bar to upload a local data source. One-click upload is supported. Once the upload finishes, click **Exit**.

![Image](/connectDataSource/3.png)

After the upload is complete, go back to the home page and select the data source you just uploaded to start your analysis tasks.

![Image](/connectDataSource/4.png)

### MySQL (Remote) Database

Connecting a remote database is almost the same as above. The only difference is that you should set **Data Type** to MySQL, then fill in the MySQL host, port, account and password, and the database name to access. Save once you are done.

![Image](/connectDataSource/5.png)

## Working with Knowledge Bases

A dataset alone carries very little context. When InfiniSynapse analyzes it directly, it often lacks background knowledge about the dataset, your preferred conventions, or your company's domain knowledge.

InfiniSynapse innovatively lets you **bind a single database to multiple knowledge bases**, so that InfiniSynapse can proactively pull relevant business knowledge from those knowledge bases — including data definitions, field descriptions, calculation logic, and even prior analysis cases — making it highly professional and a capable assistant.

### Knowledge Base Formats

These include, but are not limited to:

1.  Data source information, such as table descriptions and schema descriptions.

2.  Historical analysis documents, for example analysis reports and cases you previously wrote about this data source — you can drop them in directly.

3.  Company or personal reference documents, which can be any kind of information.

Supported knowledge base formats:

1.  Any text format, such as Markdown, TXT, etc.

2.  Office formats such as Word, Excel and PowerPoint.

3.  PDF (scanned PDFs are not supported).

### Creating a Knowledge Base

Step 1: Create the knowledge base.

On the home page, click **Knowledge Base** — **Add Knowledge Base**, fill in the knowledge base name and description, then click **Confirm** to finish creating it.

![Image](/connectDataSource/6.png)

![Image](/connectDataSource/7.png)

Step 2: Upload knowledge base content.

Click **Upload File** in the action bar, choose the corresponding files locally, and upload them in one click.

![Image](/connectDataSource/8.png)

Step 3: Assign the knowledge base to the associated data source.

Click **Bind Data Source** in the action bar, select the corresponding data source to associate, then click **Confirm**.

![Image](/connectDataSource/9.png)

After that, you can select the data source on the home page and start your task. You will see that InfiniSynapse understands the data source through the knowledge base.

![Image](/connectDataSource/10.png)

At this point you can see that InfiniSynapse pulls more information relevant to the task from the knowledge base.

![Image](/connectDataSource/11.png)
