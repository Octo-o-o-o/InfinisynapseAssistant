# Connect Data Sources and Knowledge Base


# 如何连接数据源和知识库

## 数据库使用说明

InfiniSynapse 作为一个 AI 数据分析软件，数据的上传和使用是最核心的部分。InfiniSynapse 会将任意数据映射成数据库，**支持上传100+种数据格式**，无论是文件目录（里面可能是 excel 或者 parquet，csv，json等格式的文件），还是MySQL, Oracle, 亦或是 数仓诸如 Hive, Impala。

在 InfiniSynapse 中，直接在 【数据源】里创建数据库，然后上传文件。之后就可以在 【智能问答】页面选择使用了。

### 本地数据库

第一步：首页点击「我的数据」——「数据源」

![Image](/connectDataSource/1.png)

第二步：点击「新增数据源」，填写名称、昵称、描述、类型后，点击「确定」即可。

![Image](/connectDataSource/2.png)

第三步：上传本地文件。

在操作栏点击「上传文件」即可上传本地数据源，支持一键上传，完成上传后，点击「退出」即可。

![Image](/connectDataSource/3.png)

上传完成后，回到首页，选择刚才上传的数据源即可开始分析任务了～

![Image](/connectDataSource/4.png)

### MySQL（远程）数据库

链接远程数据库的方法基本和前文一致，只是需要注意「数据类型」选择 MySQL，然后分别填写 MySQL 数据库地址、端口、账户和密码、访问的库名，填写完成后保存即可。

![Image](/connectDataSource/5.png)

## 知识库使用说明

数据集的信息包含还是非常少的，InfiniSynapse 直接做分析，其实会缺乏对这个数据集的背景知识亦或是你喜欢的偏好范式，亦或者是公司的一些背景知识。

InfiniSynapse 创造性的允许**将一个数据库和多个知识库进行绑定**，使得 InfiniSynpase 主动从知识库获取相关业务知识的情况，包括数据口径，数据说明，计算逻辑，甚至是分析案例，从而表现得非常专业，成为您的得力助手。

### 知识库格式

包括但不限于：

1.  数据源信息，比如表描述，表结构描述

2.  用户历史分析文档，比如以前用户写过对这个数据源的一些分析报告和分析案例，你也可以直接放进去。

3.  公司/个人的一些资料文档，可以是任意信息。

知识库的格式支持：

1.  任何文本格式，比如 markdown, txt 等

2.  Word, excel, ppt 等 office 软件格式

3.  PDF 格式（但不支持扫描版）

### 创建知识库

第一步：创建知识库。

在首页点击「知识库」——「新增知识库」，填写知识库名称、功能描述，点击「确认」，知识库即可创建完成。

![Image](/connectDataSource/6.png)

![Image](/connectDataSource/7.png)

第二步：上传知识库内容。

在操作栏点击「上传文件」，在本地选择好对应文件后，一键上传即可。

![Image](/connectDataSource/8.png)

第三步：把知识库指定给关联的数据源。

在操作栏点击「绑定数据源」，选择对应的数据源进行关联，然后点击「确认」。

![Image](/connectDataSource/9.png)

然后，你就可以在首页选择该数据源开始任务了：此时可以看到，InfiniSynapse 会通过知识库去了解这个数据源

![Image](/connectDataSource/10.png)

此时可以看到，InfiniSynapse 会去知识库提取有关这个任务的更多信息。

![Image](/connectDataSource/11.png)
