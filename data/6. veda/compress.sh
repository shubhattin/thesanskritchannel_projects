#!/bin/bash

7z a -t7z -mx=9 raw_data.7z raw_data

du -sh raw_data.7z

cp raw_data.7z ~/Downloads/veda_raw_data.7z