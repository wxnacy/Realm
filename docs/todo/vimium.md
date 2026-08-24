## 1.0

参考项目 `/Volumes/ZhiTai/Projects/github/vimium`

- 设置页面左边栏增加一个条目 vim 模式，点击设置页面中第一行有个开启按钮，默认关闭，下边显示快捷说明表格

- 第一版实现的键位如下

```
?       show the help dialog for a list of all available keys
h       scroll left
j       scroll down
k       scroll up
l       scroll right
gg      scroll to top of the page
G       scroll to bottom of the page
d       scroll down half a page
u       scroll up half a page
f       open a link in the current tab
F       open a link in a new tab
r       reload
R       Hard reload the page (skip the cache)
gs      view source
yy      copy the current url to the clipboard
yf      copy a link url to the clipboard
H       go back in history
L       go forward in history
J, gT   go one tab left
K, gt   go one tab right
g0      go to the first tab. Use ng0 to go to n-th tab
g$      go to the last tab
^       visit the previously-visited tab
t       create tab
yt      duplicate current tab
x       close current tab
X       restore closed tab (i.e. unwind the 'x' command)
T       search through your open tabs
W       move current tab to new window
<a-p>   pin/unpin current tab
```
